import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "../src/services/rbac.service.js";
import { app } from "./helpers/app.js";
import { createTestAdminUser } from "./helpers/db.js";

// These tests deliberately run WITHOUT any JEEVAMITRA_FIREBASE_* env var set
// (see vitest.config.ts) — proving the normal test suite needs no
// production Firebase credentials at all. Mirrors tests/pasumithra.routes.test.ts.

const PASSWORD = "correct-horse-battery-staple";

async function loginAs(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return res.body.token as string;
}

beforeEach(async () => {
  await createTestAdminUser({ email: "super@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.SUPER_ADMIN });
  await createTestAdminUser({ email: "admin@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.ADMIN });
});

describe("JeevaMitra routes — authentication", () => {
  it("rejects every route with 401 when no token is provided", async () => {
    for (const path of ["/health", "/dashboard", "/users", "/disease-alerts"]) {
      const res = await request(app).get(`/api/jeevamitra${path}`);
      expect(res.status).toBe(401);
    }
  });
});

describe("JeevaMitra routes — RBAC (dedicated jeevamitra:read permission)", () => {
  it("forbids ADMIN, which does not have jeevamitra:read by default", async () => {
    const token = await loginAs("admin@example.com");
    const res = await request(app).get("/api/jeevamitra/health").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows SUPER_ADMIN (implicit access to every permission)", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/jeevamitra/health").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("forbids POST/PUT/PATCH/DELETE on every jeevamitra path — no mutation route exists", async () => {
    const token = await loginAs("super@example.com");
    for (const path of ["/health", "/dashboard", "/users", "/disease-alerts"]) {
      const post = await request(app).post(`/api/jeevamitra${path}`).set("Authorization", `Bearer ${token}`);
      expect(post.status).toBe(404); // no route registered at all for this method+path
      const del = await request(app).delete(`/api/jeevamitra${path}`).set("Authorization", `Bearer ${token}`);
      expect(del.status).toBe(404);
    }
  });
});

describe("JeevaMitra routes — graceful handling with no Firebase credentials configured", () => {
  it("GET /health never throws — reports configuration_error as a normal 200 health result", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/jeevamitra/health").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.health.status).toBe("configuration_error");
    expect(res.body.health.lastCheckedAt).toBeTruthy();
    expect(res.body.health.status).not.toBe("healthy");
  });

  it("GET /dashboard responds 503 with a sanitized message, never a raw Firebase error", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/jeevamitra/dashboard").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe("JeevaMitra integration is not reachable right now.");
    expect(res.body.error.details).toEqual({ code: "configuration_error" });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/JEEVAMITRA_FIREBASE_PRIVATE_KEY/);
    expect(raw).not.toMatch(/at Module\./); // a stack trace frame
  });

  it("GET /users and /disease-alerts respond 503 the same sanitized way", async () => {
    const token = await loginAs("super@example.com");
    for (const path of ["/users", "/disease-alerts"]) {
      const res = await request(app).get(`/api/jeevamitra${path}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(503);
      expect(res.body.error.message).toBe("JeevaMitra integration is not reachable right now.");
    }
  });

  it("validates query params before ever touching the adapter", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app)
      .get("/api/jeevamitra/disease-alerts?isActive=not-a-boolean")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("rejects a limit above the maximum", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/jeevamitra/users?limit=500").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("JeevaMitra routes — audit logging", () => {
  it("records INTEGRATION_HEALTH_CHECKED with the resulting status", async () => {
    const token = await loginAs("super@example.com");
    await request(app).get("/api/jeevamitra/health").set("Authorization", `Bearer ${token}`);

    const auditRes = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const entry = auditRes.body.auditLogs.find((e: { action: string }) => e.action === "INTEGRATION_HEALTH_CHECKED");
    expect(entry).toBeDefined();
    expect(entry.metadata.applicationSlug).toBe("jeevamitra");
    expect(entry.metadata.status).toBe("configuration_error");
  });

  it("records a failed INTEGRATION_DATA_ACCESSED attempt even when the adapter is unreachable", async () => {
    const token = await loginAs("super@example.com");
    await request(app).get("/api/jeevamitra/users").set("Authorization", `Bearer ${token}`);

    const auditRes = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const entry = auditRes.body.auditLogs.find(
      (e: { action: string; metadata: { resource?: string } }) =>
        e.action === "INTEGRATION_DATA_ACCESSED" && e.metadata?.resource === "users",
    );
    expect(entry).toBeDefined();
    expect(entry.metadata.success).toBe(false);
    // Never store credentials/tokens/sensitive payloads in audit metadata.
    expect(JSON.stringify(entry.metadata)).not.toMatch(/phone|token|secret|key/i);
  });
});
