import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./helpers/app.js";

describe("GET /api/health", () => {
  it("reports ok with a live database connection, unauthenticated", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("up");
    expect(typeof res.body.responseTimeMs).toBe("number");
  });
});
