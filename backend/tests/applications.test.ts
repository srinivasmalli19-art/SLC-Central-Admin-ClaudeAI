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

describe("Application registry CRUD", () => {
  it("creates an application with a derived slug", async () => {
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pasumithra", platform: "React/Vite + Firebase", status: "ACTIVE" });

    expect(res.status).toBe(201);
    expect(res.body.application.slug).toBe("pasumithra");
    expect(res.body.application.status).toBe("ACTIVE");
    expect(res.body.application.enabled).toBe(false); // never defaults to enabled
  });

  it("rejects a duplicate slug with 409", async () => {
    await request(app).post("/api/applications").set("Authorization", `Bearer ${token}`).send({ name: "JeevaMitra" });
    const dupe = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "JeevaMitra" });

    expect(dupe.status).toBe(409);
  });

  it("lists created applications", async () => {
    await request(app).post("/api/applications").set("Authorization", `Bearer ${token}`).send({ name: "NearSip" });

    const res = await request(app).get("/api/applications").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.applications[0].name).toBe("NearSip");
  });

  it("gets a single application by id, and 404s for an unknown id", async () => {
    const created = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Pasunestam" });

    const found = await request(app)
      .get(`/api/applications/${created.body.application.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(found.status).toBe(200);
    expect(found.body.application.name).toBe("Pasunestam");

    const missing = await request(app)
      .get("/api/applications/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  it("updates an application", async () => {
    const created = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "SLC GPS Camera" });

    const updated = await request(app)
      .patch(`/api/applications/${created.body.application.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DISABLED", description: "No backend — registry-only entry" });

    expect(updated.status).toBe(200);
    expect(updated.body.application.status).toBe("DISABLED");
    expect(updated.body.application.description).toBe("No backend — registry-only entry");
  });

  it("deletes an application", async () => {
    const created = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "To Delete" });

    const deleted = await request(app)
      .delete(`/api/applications/${created.body.application.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const getAfterDelete = await request(app)
      .get(`/api/applications/${created.body.application.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getAfterDelete.status).toBe(404);
  });
});
