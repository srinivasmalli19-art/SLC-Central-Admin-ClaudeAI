import { Timestamp } from "firebase-admin/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getPasumithraFirestore,
  resetPasumithraFirebaseAppForTests,
} from "../../../../src/integrations/adapters/pasumithra/firebaseClient.js";
import { PasumithraAdapter, PasumithraUnavailableError } from "../../../../src/integrations/adapters/pasumithra/pasumithraAdapter.js";

// Runs ONLY via `npm run test:pasumithra:emulator` (backend/package.json),
// which wraps this in `firebase emulators:exec --project
// demo-pasumithra-adc10 ...` — the Firebase CLI exports
// FIRESTORE_EMULATOR_HOST into this process automatically. No production
// Firebase project or credentials are used anywhere in this file; the
// project id below is a fake "demo-" id that only the emulator recognizes.
// See docs/PASUMITHRA-ADAPTER.md "Testing" for why the emulator is used for
// these tests and unit tests (config.test.ts / errorClassification.test.ts)
// are used for the parts the emulator can't exercise (real config/auth
// failures).

const PROJECT_ID = "demo-pasumithra-adc10";

async function clearCollection(collectionName: string) {
  const db = getPasumithraFirestore();
  const snap = await db.collection(collectionName).get();
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}

async function clearAllFixtures() {
  await clearCollection("users");
  await clearCollection("admins");
  await clearCollection("reports");
  const db = getPasumithraFirestore();
  const listingsSnap = await db.collection("listings").get();
  for (const listingDoc of listingsSnap.docs) {
    const healthSnap = await listingDoc.ref.collection("healthRecords").get();
    await Promise.all(healthSnap.docs.map((doc) => doc.ref.delete()));
    await listingDoc.ref.delete();
  }
}

beforeAll(() => {
  process.env.PASUMITHRA_FIREBASE_PROJECT_ID = PROJECT_ID;
});

afterEach(async () => {
  await clearAllFixtures();
});

afterAll(async () => {
  await resetPasumithraFirebaseAppForTests();
});

describe("PasumithraAdapter against the Firestore emulator — read operations", () => {
  const adapter = new PasumithraAdapter();

  it("getHealth() reports healthy against a real, reachable Firestore", async () => {
    const health = await adapter.getHealth();
    expect(health.status).toBe("healthy");
    expect(typeof health.responseTimeMs).toBe("number");
    expect(health.errorMessage).toBeUndefined();
  });

  it("listUsers() returns an empty array when the users collection is empty", async () => {
    expect(await adapter.listUsers()).toEqual([]);
  });

  it("listUsers() maps real documents to PasumithraUserSummaryDto and respects limit", async () => {
    const db = getPasumithraFirestore();
    await db.collection("users").doc("user-1").set({
      name: "Ramu",
      phone: "9876543210",
      isBlocked: false,
      sellerVerified: true,
      joinedAt: Timestamp.fromDate(new Date("2026-01-01")),
    });
    await db.collection("users").doc("user-2").set({
      name: "Sita",
      phone: "9123456780",
      isBlocked: true,
      joinedAt: Timestamp.fromDate(new Date("2026-02-01")),
    });

    const users = await adapter.listUsers({ limit: 1 });
    expect(users).toHaveLength(1);

    const all = await adapter.listUsers();
    expect(all).toHaveLength(2);
    const ramu = all.find((u) => u.id === "user-1")!;
    expect(ramu).toEqual({
      id: "user-1",
      name: "Ramu",
      phone: "9876543210",
      isBlocked: false,
      sellerVerified: true,
      joinedAt: new Date("2026-01-01").toISOString(),
    });
    // sellerVerified was never set on user-2 — defaults to false, not undefined/crash.
    const sita = all.find((u) => u.id === "user-2")!;
    expect(sita.sellerVerified).toBe(false);
  });

  it("listUsers() handles a document with an unexpected field type instead of crashing", async () => {
    const db = getPasumithraFirestore();
    // `phone` stored as a number and `isBlocked` as a string, by mistake —
    // `joinedAt` is present (Firestore's orderBy excludes documents missing
    // the ordered field entirely, which isn't the scenario under test here;
    // real Pasumithra documents always have joinedAt).
    await db.collection("users").doc("weird-user").set({
      name: "Odd Doc",
      phone: 12345,
      isBlocked: "yes",
      joinedAt: Timestamp.fromDate(new Date("2026-01-01")),
    });

    const users = await adapter.listUsers();
    expect(users).toHaveLength(1);
    expect(users[0].phone).toBeNull(); // wrong type (number, not string) -> null, never crashes, never coerced
    expect(users[0].isBlocked).toBe(false); // wrong type (string, not boolean) -> safe default, not the string "yes"
  });

  it("listEntities('listings') maps documents to PasumithraListingSummaryDto and excludes sellerPhone/imageUrls", async () => {
    const db = getPasumithraFirestore();
    await db.collection("listings").doc("listing-1").set({
      title: "Healthy Jersey Cow",
      category: "cow",
      breed: "Jersey",
      district: "Chittoor",
      price: 45000,
      status: "active",
      sellerId: "user-1",
      sellerName: "Ramu",
      sellerPhone: "9876543210",
      imageUrls: ["https://example.com/a.jpg"],
      postedAt: Timestamp.fromDate(new Date("2026-03-01")),
    });

    const listings = await adapter.listEntities("listings");
    expect(listings).toHaveLength(1);
    const listing = listings[0] as Record<string, unknown>;
    expect(listing).toMatchObject({
      id: "listing-1",
      title: "Healthy Jersey Cow",
      category: "cow",
      breed: "Jersey",
      district: "Chittoor",
      price: 45000,
      status: "active",
      sellerName: "Ramu",
    });
    expect(listing.sellerPhone).toBeUndefined();
    expect(listing.imageUrls).toBeUndefined();
  });

  it("listEntities('listings', { status }) filters by status", async () => {
    const db = getPasumithraFirestore();
    await db.collection("listings").doc("active-1").set({
      title: "Active One",
      status: "active",
      postedAt: Timestamp.fromDate(new Date("2026-03-01")),
    });
    await db.collection("listings").doc("pending-1").set({
      title: "Pending One",
      status: "pending",
      postedAt: Timestamp.fromDate(new Date("2026-03-02")),
    });

    const active = await adapter.listEntities("listings", { status: "active" });
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("Active One");
  });

  it("listEntities() rejects an unsupported entity type", async () => {
    await expect(adapter.listEntities("not-a-real-type")).rejects.toThrow(/does not support entity type/);
  });

  it("listAdmins() maps admins collection documents and drops unexpected extra fields", async () => {
    const db = getPasumithraFirestore();
    await db.collection("admins").doc("admin-uid-1").set({
      email: "admin@pasumitra.com",
      name: "Chandu",
      role: "superadmin",
      createdAt: Timestamp.fromDate(new Date("2026-01-01")),
      // Not a real Pasumithra field, but proves the mapper allowlists rather
      // than spreading raw document data.
      internalDebugNote: "should never appear in the DTO",
    });

    const admins = await adapter.listAdmins();
    expect(admins).toHaveLength(1);
    expect(admins[0]).toEqual({
      id: "admin-uid-1",
      email: "admin@pasumitra.com",
      name: "Chandu",
      role: "superadmin",
      createdAt: new Date("2026-01-01").toISOString(),
    });
    expect((admins[0] as Record<string, unknown>).internalDebugNote).toBeUndefined();
  });

  it("getAnalyticsSummary() computes counts matching seeded fixture data", async () => {
    const db = getPasumithraFirestore();
    await db.collection("users").doc("u1").set({ isBlocked: false, sellerVerified: true });
    await db.collection("users").doc("u2").set({ isBlocked: true, sellerVerified: false });
    await db.collection("listings").doc("l1").set({ status: "active", category: "cow", district: "Chittoor" });
    await db.collection("listings").doc("l2").set({ status: "sold", isSold: true, category: "goat", district: "Kadapa" });
    await db.collection("reports").doc("r1").set({ status: "OPEN" });

    const summary = await adapter.getAnalyticsSummary();
    expect(summary.totalUsers).toBe(2);
    expect(summary.activeUsers).toBe(1);
    expect(summary.verifiedSellers).toBe(1);
    expect(summary.totalListings).toBe(2);
    expect(summary.activeListings).toBe(1);
    expect(summary.soldListings).toBe(1);
    expect(summary.pendingReports).toBe(1);
    expect(summary.reportedListings).toBe(1); // mirrors pendingReports, per admin.js's own simplification
    expect(summary.pendingVerifications).toBe(0); // no verification queue exists in Pasumithra — always 0
    expect(summary.listingsByCategory).toEqual(
      expect.arrayContaining([
        { name: "cow", value: 1 },
        { name: "goat", value: 1 },
      ]),
    );
    expect(summary.listingsByDistrict).toEqual([{ name: "Chittoor", value: 1 }]); // only "active" counts here
  });
});

describe("PasumithraAdapter — unavailable path (Firestore unreachable)", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await resetPasumithraFirebaseAppForTests();
  });

  it(
    "getHealth() reports 'unavailable' (never 'healthy') when Firestore can't be reached",
    async () => {
      await resetPasumithraFirebaseAppForTests();
      // Nothing listens on this port — connection will eventually be refused
      // / time out at the gRPC layer, which takes longer than Vitest's
      // default 15s test timeout.
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:59999");

      const adapter = new PasumithraAdapter();
      const health = await adapter.getHealth();

      expect(health.status).not.toBe("healthy");
      expect(["unavailable", "auth_error"]).toContain(health.status);
      expect(health.errorMessage).toBeTruthy();
    },
    60000,
  );

  it(
    "listUsers() throws PasumithraUnavailableError instead of returning fake empty data",
    async () => {
      await resetPasumithraFirebaseAppForTests();
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:59999");

      const adapter = new PasumithraAdapter();
      await expect(adapter.listUsers()).rejects.toBeInstanceOf(PasumithraUnavailableError);
    },
    60000,
  );
});
