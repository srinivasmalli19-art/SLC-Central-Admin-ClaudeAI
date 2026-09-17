import { Timestamp } from "firebase-admin/firestore";
import { logger } from "../../../config/logger.js";
import type { AppAdapter, AppMeta, HealthStatus } from "../AppAdapter.js";
import type { PasumithraDashboardSummaryDto, PasumithraListingSummaryDto, PasumithraUserSummaryDto } from "./dto.js";
import { classifyFirestoreError } from "./errorClassification.js";
import { PasumithraConfigurationError, getPasumithraFirestore } from "./firebaseClient.js";
import { toAdminDto, toListingSummaryDto, toUserSummaryDto } from "./mappers.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function clampLimit(requested: number | undefined): number {
  if (!requested || requested <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(requested, MAX_LIST_LIMIT);
}

// Thrown by any adapter method when Pasumithra's Firestore can't be reached
// or the credential is invalid — callers (the pasumithra controller) map
// this to a 503 with a sanitized message, never a raw Firebase error. See
// docs/PASUMITHRA-ADAPTER.md "Health check design".
export class PasumithraUnavailableError extends Error {
  code: "unavailable" | "auth_error" | "configuration_error";

  constructor(code: "unavailable" | "auth_error" | "configuration_error", message: string) {
    super(message);
    this.name = "PasumithraUnavailableError";
    this.code = code;
  }
}

function toUnavailableError(err: unknown): PasumithraUnavailableError {
  if (err instanceof PasumithraConfigurationError) {
    return new PasumithraUnavailableError("configuration_error", err.message);
  }
  const classified = classifyFirestoreError(err);
  return new PasumithraUnavailableError(classified.status, classified.message);
}

export class PasumithraAdapter implements AppAdapter {
  getInfo(): AppMeta {
    return { slug: "pasumithra", name: "Pasumithra" };
  }

  async getHealth(): Promise<HealthStatus> {
    const startedAt = Date.now();
    const lastCheckedAt = new Date().toISOString();

    try {
      const firestore = getPasumithraFirestore();
      // Cheapest meaningful check: a real, minimal read against a real
      // collection — proves both network connectivity and that the
      // configured credential has read access, without reading meaningful
      // volumes of data.
      await firestore.collection("admins").limit(1).get();
      return { status: "healthy", responseTimeMs: Date.now() - startedAt, lastCheckedAt };
    } catch (err) {
      const unavailable = toUnavailableError(err);
      logger.warn({ err, adapter: "pasumithra" }, "Pasumithra health check failed");
      return {
        status: unavailable.code,
        responseTimeMs: Date.now() - startedAt,
        lastCheckedAt,
        errorMessage: unavailable.message,
      };
    }
  }

  async listUsers(params: { limit?: number } = {}): Promise<PasumithraUserSummaryDto[]> {
    try {
      const firestore = getPasumithraFirestore();
      const snap = await firestore.collection("users").orderBy("joinedAt", "desc").limit(clampLimit(params.limit)).get();
      return snap.docs.map((doc) => toUserSummaryDto(doc.id, doc.data()));
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  async listEntities(
    entityType: string,
    params: { limit?: number; status?: string } = {},
  ): Promise<PasumithraListingSummaryDto[]> {
    if (entityType !== "listings") {
      throw new Error(`Pasumithra adapter does not support entity type "${entityType}"`);
    }

    try {
      const firestore = getPasumithraFirestore();
      let query = firestore.collection("listings").orderBy("postedAt", "desc").limit(clampLimit(params.limit));
      if (params.status) {
        query = firestore
          .collection("listings")
          .where("status", "==", params.status)
          .orderBy("postedAt", "desc")
          .limit(clampLimit(params.limit));
      }
      const snap = await query.get();
      return snap.docs.map((doc) => toListingSummaryDto(doc.id, doc.data()));
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  // Pasumithra-specific — not part of the shared AppAdapter interface,
  // since "admins" (Pasumithra's own staff collection, distinct from its
  // customer-facing `users`) isn't a generic concept every adapter has.
  async listAdmins() {
    try {
      const firestore = getPasumithraFirestore();
      const snap = await firestore.collection("admins").get();
      return snap.docs.map((doc) => toAdminDto(doc.id, doc.data()));
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  async getAnalyticsSummary(): Promise<PasumithraDashboardSummaryDto> {
    try {
      const firestore = getPasumithraFirestore();
      const usersCol = firestore.collection("users");
      const listingsCol = firestore.collection("listings");
      const reportsCol = firestore.collection("reports");
      const healthGroup = firestore.collectionGroup("healthRecords");

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);
      const todayStr = today.toISOString().slice(0, 10);

      // Named + Promise.allSettled, same resilient pattern Pasumithra's own
      // admin-portal uses (admin.js getOperationsDashboard) — one missing
      // index or transient permission error on a single metric degrades
      // that metric to 0 instead of failing the whole dashboard. If EVERY
      // metric fails, that's a real outage, not an isolated glitch — thrown
      // below instead of silently returning an all-zero "looks connected"
      // response.
      const metricQueries: Record<string, () => Promise<number>> = {
        totalUsers: () => usersCol.count().get().then((s) => s.data().count),
        activeUsers: () =>
          usersCol
            .where("isBlocked", "==", false)
            .count()
            .get()
            .then((s) => s.data().count),
        verifiedSellers: () =>
          usersCol
            .where("sellerVerified", "==", true)
            .count()
            .get()
            .then((s) => s.data().count),
        totalListings: () => listingsCol.count().get().then((s) => s.data().count),
        activeListings: () =>
          listingsCol
            .where("status", "==", "active")
            .count()
            .get()
            .then((s) => s.data().count),
        soldListings: () =>
          listingsCol
            .where("isSold", "==", true)
            .count()
            .get()
            .then((s) => s.data().count),
        totalHealthRecords: () => healthGroup.count().get().then((s) => s.data().count),
        pendingReports: () =>
          reportsCol
            .where("status", "==", "OPEN")
            .count()
            .get()
            .then((s) => s.data().count),
        newListingsToday: () =>
          listingsCol
            .where("postedAt", ">=", todayTimestamp)
            .count()
            .get()
            .then((s) => s.data().count),
        upcomingVaccinations: () =>
          healthGroup
            .where("recordType", "==", "vaccination")
            .where("nextDueDate", ">=", todayStr)
            .count()
            .get()
            .then((s) => s.data().count),
        upcomingDeworming: () =>
          healthGroup
            .where("recordType", "==", "deworming")
            .where("nextDueDate", ">=", todayStr)
            .count()
            .get()
            .then((s) => s.data().count),
        pregnantAnimals: () =>
          healthGroup
            .where("recordType", "==", "pregnancy_check")
            .count()
            .get()
            .then((s) => s.data().count),
        upcomingCalving: () =>
          healthGroup
            .where("recordType", "==", "pregnancy_check")
            .where("nextDueDate", ">=", todayStr)
            .count()
            .get()
            .then((s) => s.data().count),
      };

      const names = Object.keys(metricQueries);
      const settled = await Promise.allSettled(names.map((name) => metricQueries[name]()));

      if (settled.every((result) => result.status === "rejected")) {
        throw (settled[0] as PromiseRejectedResult).reason;
      }

      const counts: Record<string, number> = {};
      settled.forEach((result, i) => {
        const name = names[i];
        if (result.status === "fulfilled") {
          counts[name] = result.value;
        } else {
          counts[name] = 0;
          logger.warn({ err: result.reason, adapter: "pasumithra", metric: name }, "Pasumithra dashboard metric failed");
        }
      });

      const [listingsByCategory, listingsByDistrict] = await Promise.all([
        this.computeListingsByCategory(listingsCol),
        this.computeListingsByDistrict(listingsCol),
      ]);

      return {
        totalUsers: counts.totalUsers,
        activeUsers: counts.activeUsers,
        verifiedSellers: counts.verifiedSellers,
        totalListings: counts.totalListings,
        activeListings: counts.activeListings,
        soldListings: counts.soldListings,
        totalHealthRecords: counts.totalHealthRecords,
        pendingReports: counts.pendingReports,
        newListingsToday: counts.newListingsToday,
        upcomingVaccinations: counts.upcomingVaccinations,
        upcomingDeworming: counts.upcomingDeworming,
        pregnantAnimals: counts.pregnantAnimals,
        upcomingCalving: counts.upcomingCalving,
        // Same simplification Pasumithra's own admin-portal makes today
        // (admin.js): every report carries a listingId, and distinguishing
        // unique reported sellers would need reading documents, not just a
        // count.
        reportedListings: counts.pendingReports,
        reportedSellers: counts.pendingReports,
        // No verification-request queue exists in Pasumithra yet —
        // sellerVerified is set directly by an admin, per admin.js's own
        // comment. Mirrored here, not invented.
        pendingVerifications: 0,
        listingsByCategory,
        listingsByDistrict,
      };
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  private async computeListingsByCategory(
    listingsCol: FirebaseFirestore.CollectionReference,
  ): Promise<Array<{ name: string; value: number }>> {
    const snap = await listingsCol.select("category").get();
    const counts: Record<string, number> = {};
    snap.forEach((doc) => {
      const category = (doc.data().category as string | undefined) || "other";
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }

  private async computeListingsByDistrict(
    listingsCol: FirebaseFirestore.CollectionReference,
  ): Promise<Array<{ name: string; value: number }>> {
    const snap = await listingsCol.where("status", "==", "active").select("district").get();
    const counts: Record<string, number> = {};
    snap.forEach((doc) => {
      const district = (doc.data().district as string | undefined) || "Unknown";
      counts[district] = (counts[district] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }
}
