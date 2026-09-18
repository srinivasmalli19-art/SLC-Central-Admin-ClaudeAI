import { Timestamp } from "firebase-admin/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getJeevaMitraFirestore,
  resetJeevaMitraFirebaseAppForTests,
} from "../../../../src/integrations/adapters/jeevamitra/firebaseClient.js";
import {
  JeevaMitraAdapter,
  JeevaMitraUnavailableError,
} from "../../../../src/integrations/adapters/jeevamitra/jeevamitraAdapter.js";

// Runs ONLY via `npm run test:jeevamitra:emulator` (backend/package.json),
// which wraps this in `firebase emulators:exec --project demo-jeevamitra
// ...` — the Firebase CLI exports FIRESTORE_EMULATOR_HOST into this process
// automatically. No production Firebase project or credentials are used
// anywhere in this file; the project id below is a fake "demo-" id that
// only the emulator recognizes. Mirrors
// tests/adapters/pasumithra/emulator/pasumithraAdapter.test.ts — see
// docs/JEEVAMITRA-ADAPTER.md "Testing" for why the emulator is used here
// and unit tests (config.test.ts / errorClassification.test.ts) cover the
// parts the emulator can't exercise (real config/auth failures).

const PROJECT_ID = "demo-jeevamitra";

async function clearCollection(collectionName: string) {
  const db = getJeevaMitraFirestore();
  const snap = await db.collection(collectionName).get();
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}

async function clearAllFixtures() {
  await clearCollection("users");
  await clearCollection("farms");
  await clearCollection("bookings");
  await clearCollection("disease_alerts");
}

beforeAll(() => {
  process.env.JEEVAMITRA_FIREBASE_PROJECT_ID = PROJECT_ID;
});

afterEach(async () => {
  await clearAllFixtures();
});

afterAll(async () => {
  await resetJeevaMitraFirebaseAppForTests();
});

describe("JeevaMitraAdapter against the Firestore emulator — read operations", () => {
  const adapter = new JeevaMitraAdapter();

  it("getHealth() reports healthy against a real, reachable Firestore", async () => {
    const health = await adapter.getHealth();
    expect(health.status).toBe("healthy");
    expect(typeof health.responseTimeMs).toBe("number");
    expect(health.errorMessage).toBeUndefined();
  });

  it("listUsers() returns an empty array when the users collection is empty", async () => {
    expect(await adapter.listUsers()).toEqual([]);
  });

  it("listUsers() maps real documents to JeevaMitraUserSummaryDto and NEVER returns phone", async () => {
    const db = getJeevaMitraFirestore();
    await db.collection("users").doc("user-1").set({
      name: "Ramu",
      phone: "9876543210",
      role: "farmer",
      district: "Guntur",
      isVerified: true,
      createdAt: Timestamp.fromDate(new Date("2026-01-01")),
    });
    await db.collection("users").doc("user-2").set({
      name: "Lakshmi",
      phone: "9123456780",
      role: "shepherd",
      district: "Kadapa",
      createdAt: Timestamp.fromDate(new Date("2026-02-01")),
    });

    const users = await adapter.listUsers({ limit: 1 });
    expect(users).toHaveLength(1);

    const all = await adapter.listUsers();
    expect(all).toHaveLength(2);
    const ramu = all.find((u) => u.id === "user-1")!;
    expect(ramu).toEqual({
      id: "user-1",
      name: "Ramu",
      role: "farmer",
      district: "Guntur",
      isVerified: true,
      createdAt: new Date("2026-01-01").toISOString(),
    });
    expect((ramu as Record<string, unknown>).phone).toBeUndefined();
    // isVerified was never set on user-2 — defaults to false, not undefined/crash.
    const lakshmi = all.find((u) => u.id === "user-2")!;
    expect(lakshmi.isVerified).toBe(false);
    expect((lakshmi as Record<string, unknown>).phone).toBeUndefined();
  });

  it("listUsers() returns a document that has no createdAt field at all — regression test for a real production finding", async () => {
    // A live check against the real jeevamitra project (see
    // docs/JEEVAMITRA-ADAPTER.md) found that real `users` documents do not
    // reliably have a `createdAt` field, even though the Dart entity
    // declares it `required`. listUsers() must never silently drop such a
    // document via an orderBy on a field that isn't guaranteed to exist.
    const db = getJeevaMitraFirestore();
    await db.collection("users").doc("no-created-at").set({ name: "No Timestamp", role: "farmer" });

    const users = await adapter.listUsers();
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe("no-created-at");
    expect(users[0].createdAt).toBeNull();
  });

  it("listUsers() handles a document with an unexpected field type instead of crashing", async () => {
    const db = getJeevaMitraFirestore();
    await db.collection("users").doc("weird-user").set({
      name: "Odd Doc",
      role: 12345, // wrong type
      district: true, // wrong type
      isVerified: "yes", // wrong type
      createdAt: Timestamp.fromDate(new Date("2026-01-01")),
    });

    const users = await adapter.listUsers();
    expect(users).toHaveLength(1);
    expect(users[0].role).toBeNull();
    expect(users[0].district).toBeNull();
    expect(users[0].isVerified).toBe(false);
  });

  it("listEntities('disease_alerts') maps documents and excludes symptoms/treatment/prevention/vetContactPhone/reportedBy", async () => {
    const db = getJeevaMitraFirestore();
    await db.collection("disease_alerts").doc("alert-1").set({
      disease: "Foot and Mouth Disease",
      affectedSpecies: "cattle",
      severity: "high",
      district: "Guntur",
      isActive: true,
      symptoms: "fever, blisters",
      treatment: "isolate and consult vet",
      prevention: "vaccination",
      vetContactPhone: "9876543210",
      reportedBy: "user-1",
      issuedAt: Timestamp.fromDate(new Date("2026-03-01")),
    });

    const alerts = await adapter.listEntities("disease_alerts");
    expect(alerts).toHaveLength(1);
    const alert = alerts[0] as Record<string, unknown>;
    expect(alert).toEqual({
      id: "alert-1",
      disease: "Foot and Mouth Disease",
      affectedSpecies: "cattle",
      severity: "high",
      district: "Guntur",
      isActive: true,
      issuedAt: new Date("2026-03-01").toISOString(),
    });
    expect(alert.symptoms).toBeUndefined();
    expect(alert.treatment).toBeUndefined();
    expect(alert.prevention).toBeUndefined();
    expect(alert.vetContactPhone).toBeUndefined();
    expect(alert.reportedBy).toBeUndefined();
  });

  it("listEntities('disease_alerts', { isActive: true }) filters correctly", async () => {
    const db = getJeevaMitraFirestore();
    await db.collection("disease_alerts").doc("active-1").set({
      disease: "Active Alert",
      isActive: true,
      issuedAt: Timestamp.fromDate(new Date("2026-03-01")),
    });
    await db.collection("disease_alerts").doc("inactive-1").set({
      disease: "Inactive Alert",
      isActive: false,
      issuedAt: Timestamp.fromDate(new Date("2026-03-02")),
    });

    const active = await adapter.listEntities("disease_alerts", { isActive: true });
    expect(active).toHaveLength(1);
    expect(active[0].disease).toBe("Active Alert");
  });

  it("listEntities() rejects an unsupported entity type", async () => {
    await expect(adapter.listEntities("farms")).rejects.toThrow(/does not support entity type/);
    await expect(adapter.listEntities("bookings")).rejects.toThrow(/does not support entity type/);
  });

  it("getAnalyticsSummary() computes counts matching seeded fixture data", async () => {
    const db = getJeevaMitraFirestore();
    await db.collection("users").doc("u1").set({ role: "farmer" });
    await db.collection("users").doc("u2").set({ role: "farmer" });
    await db.collection("users").doc("u3").set({ role: "shepherd" });
    await db.collection("farms").doc("f1").set({ isAvailable: true });
    await db.collection("farms").doc("f2").set({ isAvailable: false });
    await db.collection("bookings").doc("b1").set({ status: "pending" });
    await db.collection("bookings").doc("b2").set({ status: "completed" });
    await db.collection("bookings").doc("b3").set({ status: "completed" });
    await db.collection("disease_alerts").doc("a1").set({ isActive: true, severity: "critical", district: "Guntur" });
    await db.collection("disease_alerts").doc("a2").set({ isActive: true, severity: "low", district: "Guntur" });
    await db.collection("disease_alerts").doc("a3").set({ isActive: false, severity: "critical", district: "Kadapa" });

    const summary = await adapter.getAnalyticsSummary();
    expect(summary.usersByRole).toEqual({ farmer: 2, shepherd: 1 });
    expect(summary.totalFarms).toBe(2);
    expect(summary.activeFarms).toBe(1);
    expect(summary.bookingsByStatus).toEqual({ pending: 1, confirmed: 0, active: 0, completed: 2, cancelled: 0 });
    expect(summary.activeDiseaseAlertsBySeverity).toEqual({ low: 1, medium: 0, high: 0, critical: 1 });
    // Only the two isActive:true alerts count — both in Guntur.
    expect(summary.activeDiseaseAlertsByDistrict).toEqual([{ name: "Guntur", value: 2 }]);
  });
});

describe("JeevaMitraAdapter — unavailable path (Firestore unreachable)", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await resetJeevaMitraFirebaseAppForTests();
  });

  it(
    "getHealth() reports 'unavailable' (never 'healthy') when Firestore can't be reached",
    async () => {
      await resetJeevaMitraFirebaseAppForTests();
      // Nothing listens on this port — connection will eventually be refused
      // / time out at the gRPC layer, which takes longer than Vitest's
      // default 15s test timeout.
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:59998");

      const adapter = new JeevaMitraAdapter();
      const health = await adapter.getHealth();

      expect(health.status).not.toBe("healthy");
      expect(["unavailable", "auth_error"]).toContain(health.status);
      expect(health.errorMessage).toBeTruthy();
    },
    60000,
  );

  it(
    "listUsers() throws JeevaMitraUnavailableError instead of returning fake empty data",
    async () => {
      await resetJeevaMitraFirebaseAppForTests();
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:59998");

      const adapter = new JeevaMitraAdapter();
      await expect(adapter.listUsers()).rejects.toBeInstanceOf(JeevaMitraUnavailableError);
    },
    60000,
  );
});
