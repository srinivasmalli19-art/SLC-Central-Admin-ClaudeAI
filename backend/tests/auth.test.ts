import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { SYSTEM_ROLES } from "../src/services/rbac.service.js";
import { app } from "./helpers/app.js";
import { createTestAdminUser } from "./helpers/db.js";

const PASSWORD = "correct-horse-battery-staple";

describe("Authentication", () => {
  beforeEach(async () => {
    await createTestAdminUser({
      email: "super@example.com",
      password: PASSWORD,
      roleName: SYSTEM_ROLES.SUPER_ADMIN,
    });
    await createTestAdminUser({
      email: "inactive@example.com",
      password: PASSWORD,
      roleName: SYSTEM_ROLES.SUPER_ADMIN,
      isActive: false,
    });
  });

  it("logs in with correct credentials and returns a token + safe user object", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "super@example.com", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe("super@example.com");
    expect(res.body.user.role).toBe("SUPER_ADMIN");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("rejects an unknown email with 401 and a generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects a wrong password with 401 and the same generic message", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "super@example.com", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects login for a deactivated admin account", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inactive@example.com", password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("rejects malformed login payloads with 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "" });

    expect(res.status).toBe(400);
  });

  it("returns the current user from /api/auth/me given a valid token", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: "super@example.com", password: PASSWORD });

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("super@example.com");
  });
});

describe("Protected routes", () => {
  it("rejects requests with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects requests with a malformed Authorization header", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "not-a-bearer-token");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid/garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer garbage.token.value");
    expect(res.status).toBe(401);
  });
});
