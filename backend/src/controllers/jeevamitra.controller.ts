import type { Request, Response } from "express";
import { z } from "zod";
import { jeevamitraIntegrationService } from "../services/integrations/jeevamitra.service.js";
import { AuditAction, auditLogService } from "../services/auditLog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const diseaseAlertsQuerySchema = listQuerySchema.extend({
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const APPLICATION_SLUG = "jeevamitra";

// Records the access attempt regardless of outcome — mirrors
// pasumithra.controller.ts's withDataAccessAudit exactly. A JeevaMitra
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
  const health = await jeevamitraIntegrationService.checkHealth();

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
  const summary = await withDataAccessAudit(req, "dashboard", () => jeevamitraIntegrationService.getDashboardSummary());
  res.status(200).json({ summary });
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = listQuerySchema.parse(req.query);
  const users = await withDataAccessAudit(req, "users", () => jeevamitraIntegrationService.listUsers({ limit }));
  res.status(200).json({ users });
});

export const listDiseaseAlerts = asyncHandler(async (req: Request, res: Response) => {
  const { limit, isActive } = diseaseAlertsQuerySchema.parse(req.query);
  const diseaseAlerts = await withDataAccessAudit(req, "disease_alerts", () =>
    jeevamitraIntegrationService.listDiseaseAlerts({ limit, isActive }),
  );
  res.status(200).json({ diseaseAlerts });
});
