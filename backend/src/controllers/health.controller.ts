import type { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Health for the Central Admin platform itself only. Per docs/ROADMAP.md
// Phase 7, per-application health checks (via adapters) are a later phase —
// this endpoint must never report on an integrated app's status, since no
// adapter exists yet to actually check one.
export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  let databaseStatus: "up" | "down" = "up";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "down";
  }

  const responseTimeMs = Date.now() - startedAt;
  const overallStatus = databaseStatus === "up" ? "ok" : "degraded";

  res.status(databaseStatus === "up" ? 200 : 503).json({
    status: overallStatus,
    database: databaseStatus,
    responseTimeMs,
    timestamp: new Date().toISOString(),
  });
});
