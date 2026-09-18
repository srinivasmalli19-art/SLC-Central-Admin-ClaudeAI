import { logger } from "../../../config/logger.js";
import type { AppAdapter, AppMeta, HealthStatus } from "../AppAdapter.js";
import type { JeevaMitraDashboardSummaryDto, JeevaMitraDiseaseAlertDto, JeevaMitraUserSummaryDto } from "./dto.js";
import { classifyFirestoreError } from "./errorClassification.js";
import { JeevaMitraConfigurationError, getJeevaMitraFirestore } from "./firebaseClient.js";
import { toDiseaseAlertDto, toUserSummaryDto } from "./mappers.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function clampLimit(requested: number | undefined): number {
  if (!requested || requested <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(requested, MAX_LIST_LIMIT);
}

// Thrown by any adapter method when JeevaMitra's Firestore can't be reached
// or the credential is invalid — callers (the jeevamitra controller) map
// this to a 503 with a sanitized message, never a raw Firebase error. See
// docs/JEEVAMITRA-ADAPTER.md "Health check design".
export class JeevaMitraUnavailableError extends Error {
  code: "unavailable" | "auth_error" | "configuration_error";

  constructor(code: "unavailable" | "auth_error" | "configuration_error", message: string) {
    super(message);
    this.name = "JeevaMitraUnavailableError";
    this.code = code;
  }
}

function toUnavailableError(err: unknown): JeevaMitraUnavailableError {
  if (err instanceof JeevaMitraConfigurationError) {
    return new JeevaMitraUnavailableError("configuration_error", err.message);
  }
  const classified = classifyFirestoreError(err);
  return new JeevaMitraUnavailableError(classified.status, classified.message);
}

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const BOOKING_STATUSES = ["pending", "confirmed", "active", "completed", "cancelled"] as const;

export class JeevaMitraAdapter implements AppAdapter {
  getInfo(): AppMeta {
    return { slug: "jeevamitra", name: "JeevaMitra" };
  }

  async getHealth(): Promise<HealthStatus> {
    const startedAt = Date.now();
    const lastCheckedAt = new Date().toISOString();

    try {
      const firestore = getJeevaMitraFirestore();
      // Cheapest meaningful check: a real, minimal read against a real
      // collection — proves both network connectivity and that the
      // configured credential has read access, without reading meaningful
      // volumes of data. JeevaMitra has no small "admins" collection like
      // Pasumithra's, so `users` (limit 1) is the nearest equivalent.
      await firestore.collection("users").limit(1).get();
      return { status: "healthy", responseTimeMs: Date.now() - startedAt, lastCheckedAt };
    } catch (err) {
      const unavailable = toUnavailableError(err);
      logger.warn({ err, adapter: "jeevamitra" }, "JeevaMitra health check failed");
      return {
        status: unavailable.code,
        responseTimeMs: Date.now() - startedAt,
        lastCheckedAt,
        errorMessage: unavailable.message,
      };
    }
  }

  async listUsers(params: { limit?: number } = {}): Promise<JeevaMitraUserSummaryDto[]> {
    try {
      const firestore = getJeevaMitraFirestore();
      // Deliberately unordered: a live check against the real jeevamitra
      // project found that real `users` documents do not reliably have a
      // `createdAt` field (the Dart entity declares it `required`, but
      // older/real documents predate that, or it's set client-side without
      // being persisted). Firestore's orderBy silently EXCLUDES any
      // document missing the ordered field — ordering by createdAt made
      // this method return an empty list against real production data
      // despite users existing. See docs/JEEVAMITRA-ADAPTER.md.
      const snap = await firestore.collection("users").limit(clampLimit(params.limit)).get();
      return snap.docs.map((doc) => toUserSummaryDto(doc.id, doc.data()));
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  async listEntities(
    entityType: string,
    params: { limit?: number; isActive?: boolean } = {},
  ): Promise<JeevaMitraDiseaseAlertDto[]> {
    if (entityType !== "disease_alerts") {
      throw new Error(`JeevaMitra adapter does not support entity type "${entityType}"`);
    }

    try {
      const firestore = getJeevaMitraFirestore();
      const col = firestore.collection("disease_alerts");
      let query = col.orderBy("issuedAt", "desc").limit(clampLimit(params.limit));
      if (typeof params.isActive === "boolean") {
        query = col.where("isActive", "==", params.isActive).orderBy("issuedAt", "desc").limit(clampLimit(params.limit));
      }
      const snap = await query.get();
      return snap.docs.map((doc) => toDiseaseAlertDto(doc.id, doc.data()));
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  async getAnalyticsSummary(): Promise<JeevaMitraDashboardSummaryDto> {
    try {
      const firestore = getJeevaMitraFirestore();
      const usersCol = firestore.collection("users");
      const farmsCol = firestore.collection("farms");
      const bookingsCol = firestore.collection("bookings");
      const alertsCol = firestore.collection("disease_alerts");

      // Named + Promise.allSettled, same resilient pattern as the
      // Pasumithra adapter — one missing index or transient permission
      // error on a single metric degrades that metric to 0 instead of
      // failing the whole dashboard. If EVERY metric fails, that's a real
      // outage, thrown below instead of silently returning an all-zero
      // "looks connected" response.
      const metricQueries: Record<string, () => Promise<number>> = {
        usersFarmer: () =>
          usersCol.where("role", "==", "farmer").count().get().then((s) => s.data().count),
        usersShepherd: () =>
          usersCol.where("role", "==", "shepherd").count().get().then((s) => s.data().count),
        totalFarms: () => farmsCol.count().get().then((s) => s.data().count),
        activeFarms: () =>
          farmsCol.where("isAvailable", "==", true).count().get().then((s) => s.data().count),
      };
      for (const status of BOOKING_STATUSES) {
        metricQueries[`booking_${status}`] = () =>
          bookingsCol.where("status", "==", status).count().get().then((s) => s.data().count);
      }
      for (const severity of SEVERITIES) {
        metricQueries[`alertSeverity_${severity}`] = () =>
          alertsCol
            .where("isActive", "==", true)
            .where("severity", "==", severity)
            .count()
            .get()
            .then((s) => s.data().count);
      }

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
          logger.warn({ err: result.reason, adapter: "jeevamitra", metric: name }, "JeevaMitra dashboard metric failed");
        }
      });

      const activeDiseaseAlertsByDistrict = await this.computeActiveAlertsByDistrict(alertsCol);

      return {
        usersByRole: { farmer: counts.usersFarmer, shepherd: counts.usersShepherd },
        totalFarms: counts.totalFarms,
        activeFarms: counts.activeFarms,
        bookingsByStatus: {
          pending: counts.booking_pending,
          confirmed: counts.booking_confirmed,
          active: counts.booking_active,
          completed: counts.booking_completed,
          cancelled: counts.booking_cancelled,
        },
        activeDiseaseAlertsBySeverity: {
          low: counts.alertSeverity_low,
          medium: counts.alertSeverity_medium,
          high: counts.alertSeverity_high,
          critical: counts.alertSeverity_critical,
        },
        activeDiseaseAlertsByDistrict,
      };
    } catch (err) {
      throw toUnavailableError(err);
    }
  }

  private async computeActiveAlertsByDistrict(
    alertsCol: FirebaseFirestore.CollectionReference,
  ): Promise<Array<{ name: string; value: number }>> {
    const snap = await alertsCol.where("isActive", "==", true).select("district").get();
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
