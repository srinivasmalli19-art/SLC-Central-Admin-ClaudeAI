import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "../src/services/rbac.service.js";
import { app } from "./helpers/app.js";
import { createTestAdminUser } from "./helpers/db.js";

const PASSWORD = "correct-horse-battery-staple";

async function loginAs(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return res.body.token as string;
}

describe("RBAC", () => {
  beforeEach(async () => {
    await createTestAdminUser({ email: "super@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.SUPER_ADMIN });
    await createTestAdminUser({ email: "admin@example.com", password: PASSWORD, roleName: SYSTEM_ROLES.ADMIN });
  });

  it("SUPER_ADMIN can access admin-users management (implicit full access)", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app).get("/api/admin-users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.adminUsers)).toBe(true);
  });

  it("ADMIN is forbidden from admin-users management (no admin_users:manage permission)", async () => {
    const token = await loginAs("admin@example.com");
    const res = await request(app).get("/api/admin-users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("ADMIN can read applications (has applications:read by default)", async () => {
    const token = await loginAs("admin@example.com");
    const res = await request(app).get("/api/applications").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("ADMIN is forbidden from creating applications (no applications:manage permission)", async () => {
    const token = await loginAs("admin@example.com");
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Fail" });
    expect(res.status).toBe(403);
  });

  it("SUPER_ADMIN can create applications", async () => {
    const token = await loginAs("super@example.com");
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pasumithra" });
    expect(res.status).toBe(201);
  });
});
