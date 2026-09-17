import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "../src/services/rbac.service.js";
import { app } from "./helpers/app.js";
import { createTestAdminUser } from "./helpers/db.js";

// These tests deliberately run WITHOUT any PASUMITHRA_FIREBASE_* env var set
// (see vitest.config.ts) — proving the normal test suite needs no
// production Firebase credentials at all. The adapter's own
// "configuration_error" handling (see docs/PASUMITHRA-ADAPTER.md) is
// exactly what makes that possible: every route below still gets a clean,
// sanitized response instead of a crash.

const PASSWORD = "correct-horse-battery-staple";

async function loginAs(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return res.body.token as string;
}

beforeEach(async () => {
  await createTestAdminUser({ email: "super@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.SUPER_ADMIN });
  await createTestAdminUser({ email: "admin@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.ADMIN });
});

describe("Pasumithra routes — authentication", () => {
  it("rejects every route with 401 when no token is provided", async () => {
    for (const path of ["/health", "/dashboard", "/admins", "/users", "/listings"]) {
      const res = await request(app).get(`/api/pasumithra${path}`);
      expect(res.status).toBe(401);
    }
  });
});

describe("Pasumithra routes — RBAC (dedicated pasumithra:read permission)", () => {
  it("forbids ADMIN, which does not have pasumithra:read by default", async () => {
    const token = await loginAs("admin@example.com");
    const res = await request(app).get("/api/pasumithra/health").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows SUPER_ADMIN (implicit access to every permission)", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/pasumithra/health").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("Pasumithra routes — graceful handling with no Firebase credentials configured", () => {
  it("GET /health never throws — reports configuration_error as a normal 200 health result", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/pasumithra/health").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.health.status).toBe("configuration_error");
    expect(res.body.health.lastCheckedAt).toBeTruthy();
    // Never claim healthy when misconfigured.
    expect(res.body.health.status).not.toBe("healthy");
  });

  it("GET /dashboard responds 503 with a sanitized message, never a raw Firebase error", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/pasumithra/dashboard").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe("Pasumithra integration is not reachable right now.");
    expect(res.body.error.details).toEqual({ code: "configuration_error" });
    // No stack trace, no credential/env var names, no raw Firebase SDK error shape.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/PASUMITHRA_FIREBASE_PRIVATE_KEY/);
    expect(raw).not.toMatch(/at Module\./); // a stack trace frame
  });

  it("GET /admins, /users, /listings all respond 503 the same sanitized way", async () => {
    const token = await loginAs("super@example.com");
    for (const path of ["/admins", "/users", "/listings"]) {
      const res = await request(app).get(`/api/pasumithra${path}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(503);
      expect(res.body.error.message).toBe("Pasumithra integration is not reachable right now.");
    }
  });

  it("validates query params before ever touching the adapter", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app)
      .get("/api/pasumithra/listings?status=not-a-real-status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("Pasumithra routes — audit logging", () => {
  it("records INTEGRATION_HEALTH_CHECKED with the resulting status", async () => {
    const token = await loginAs("super@example.com");
    await request(app).get("/api/pasumithra/health").set("Authorization", `Bearer ${token}`);

    const auditRes = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const entry = auditRes.body.auditLogs.find((e: { action: string }) => e.action === "INTEGRATION_HEALTH_CHECKED");
    expect(entry).toBeDefined();
    expect(entry.metadata.applicationSlug).toBe("pasumithra");
    expect(entry.metadata.status).toBe("configuration_error");
  });

  it("records a failed INTEGRATION_DATA_ACCESSED attempt even when the adapter is unreachable", async () => {
    const token = await loginAs("super@example.com");
    await request(app).get("/api/pasumithra/admins").set("Authorization", `Bearer ${token}`);

    const auditRes = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const entry = auditRes.body.auditLogs.find(
      (e: { action: string; metadata: { resource?: string } }) =>
        e.action === "INTEGRATION_DATA_ACCESSED" && e.metadata?.resource === "admins",
    );
    expect(entry).toBeDefined();
    expect(entry.metadata.success).toBe(false);
  });
});
