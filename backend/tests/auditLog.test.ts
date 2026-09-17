import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "../src/services/rbac.service.js";
import { app } from "./helpers/app.js";
import { createTestAdminUser } from "./helpers/db.js";

const PASSWORD = "correct-horse-battery-staple";
let token: string;

beforeEach(async () => {
  await createTestAdminUser({ email: "super@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.SUPER_ADMIN });
  const login = await request(app).post("/api/auth/login").send({ email: "super@example.com", password: PASSWORD });
  token = login.body.token;
});

describe("Audit logging", () => {
  it("records a LOGIN entry on successful sign-in", async () => {
    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.auditLogs.some((entry: { action: string }) => entry.action === "LOGIN")).toBe(true);
  });

  it("records a LOGIN_FAILED entry on a bad password, without leaking the attempted password", async () => {
    await request(app).post("/api/auth/login").send({ email: "super@example.com", password: "totally-wrong" });

    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const failedEntry = res.body.auditLogs.find((entry: { action: string }) => entry.action === "LOGIN_FAILED");

    expect(failedEntry).toBeDefined();
    expect(JSON.stringify(failedEntry)).not.toContain("totally-wrong");
  });

  it("records an APPLICATION_CREATED entry with the actor's email attached", async () => {
    await request(app).post("/api/applications").set("Authorization", `Bearer ${token}`).send({ name: "Pasumithra" });

    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const entry = res.body.auditLogs.find((e: { action: string }) => e.action === "APPLICATION_CREATED");

    expect(entry).toBeDefined();
    expect(entry.actorEmail).toBe("super@example.com");
    expect(entry.metadata.name).toBe("Pasumithra");
  });

  it("never stores password/token/secret-looking fields even if a caller tried to pass them", async () => {
    // Exercises auditLogService's defensive sanitization directly, since no
    // current controller passes secret-shaped metadata — this guards against
    // a future regression.
    const { auditLogService, AuditAction } = await import("../src/services/auditLog.service.js");
    await auditLogService.record({
      action: AuditAction.ADMIN_USER_UPDATED,
      metadata: { password: "should-not-be-stored", apiKey: "should-not-be-stored", safeField: "keep-me" },
    });

    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${token}`);
    const entry = res.body.auditLogs.find((e: { action: string }) => e.action === "ADMIN_USER_UPDATED");

    expect(entry.metadata.password).toBeUndefined();
    expect(entry.metadata.apiKey).toBeUndefined();
    expect(entry.metadata.safeField).toBe("keep-me");
  });

  it("ADMIN can read audit logs (has audit_logs:read by default)", async () => {
    await createTestAdminUser({ email: "readonly@example.com", password: PASSWORD, roleName: "ADMIN" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "readonly@example.com", password: PASSWORD });
    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });
});
