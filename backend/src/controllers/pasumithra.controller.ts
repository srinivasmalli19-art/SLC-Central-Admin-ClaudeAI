import type { Request, Response } from "express";
import { z } from "zod";
import { pasumithraIntegrationService } from "../services/integrations/pasumithra.service.js";
import { AuditAction, auditLogService } from "../services/auditLog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const listingsQuerySchema = listQuerySchema.extend({
  status: z.enum(["active", "pending", "rejected", "suspended", "sold"]).optional(),
});

const APPLICATION_SLUG = "pasumithra";

// Records the access attempt regardless of outcome — mirrors how
// auth.controller.ts records LOGIN_FAILED, not just LOGIN. A Pasumithra
// outage is exactly the kind of event worth being able to see in the audit
// log later, not just successful reads.
async function withDataAccessAudit<T>(req: Request, resource: string, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    await auditLogService.record({
      actor: req.user,
      action: AuditAction.INTEGRATION_DATA_ACCESSED,
      targetType: "Application",
      metadata: {
        applicationSlug: APPLICATION_SLUG,
        resource,
        success: true,
        resultCount: Array.isArray(result) ? result.length : undefined,
      },
      ipAddress: req.ip,
    });
    return result;
  } catch (err) {
    await auditLogService.record({
      actor: req.user,
      action: AuditAction.INTEGRATION_DATA_ACCESSED,
      targetType: "Application",
      metadata: { applicationSlug: APPLICATION_SLUG, resource, success: false },
      ipAddress: req.ip,
    });
    throw err;
  }
}

export const getHealth = asyncHandler(async (req: Request, res: Response) => {
  // getHealth() never throws — a config/connectivity problem is itself a
  // valid, always-audited health *result*, not a failure of this endpoint.
  const health = await pasumithraIntegrationService.checkHealth();

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.INTEGRATION_HEALTH_CHECKED,
    targetType: "Application",
    metadata: { applicationSlug: APPLICATION_SLUG, status: health.status },
    ipAddress: req.ip,
  });

  res.status(200).json({ health });
});

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const summary = await withDataAccessAudit(req, "dashboard", () => pasumithraIntegrationService.getDashboardSummary());
  res.status(200).json({ summary });
});

export const listAdmins = asyncHandler(async (req: Request, res: Response) => {
  const admins = await withDataAccessAudit(req, "admins", () => pasumithraIntegrationService.listAdmins());
  res.status(200).json({ admins });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = listQuerySchema.parse(req.query);
  const users = await withDataAccessAudit(req, "users", () => pasumithraIntegrationService.listUsers({ limit }));
  res.status(200).json({ users });
});

export const listListings = asyncHandler(async (req: Request, res: Response) => {
  const { limit, status } = listingsQuerySchema.parse(req.query);
  const listings = await withDataAccessAudit(req, "listings", () =>
    pasumithraIntegrationService.listListings({ limit, status }),
  );
  res.status(200).json({ listings });
});
