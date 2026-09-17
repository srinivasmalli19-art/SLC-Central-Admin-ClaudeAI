import type { Request, Response } from "express";
import { z } from "zod";
import { applicationsService } from "../services/applications.service.js";
import { AuditAction, auditLogService } from "../services/auditLog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const APPLICATION_STATUSES = ["ACTIVE", "DISABLED", "MAINTENANCE", "PLANNED"] as const;

const createApplicationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  platform: z.string().optional(),
  environment: z.string().optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  repositoryRef: z.string().optional(),
  frontendUrl: z.string().url().optional().or(z.literal("")),
  backendUrl: z.string().url().optional().or(z.literal("")),
  integrationType: z.string().optional(),
  enabled: z.boolean().optional(),
});

const updateApplicationSchema = createApplicationSchema.partial();

export const listApplications = asyncHandler(async (_req: Request, res: Response) => {
  const applications = await applicationsService.list();
  res.status(200).json({ applications });
});

export const getApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationsService.getById(req.params.id);
  res.status(200).json({ application });
});

export const createApplication = asyncHandler(async (req: Request, res: Response) => {
  const input = createApplicationSchema.parse(req.body);
  const created = await applicationsService.create(input);

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.APPLICATION_CREATED,
    targetType: "Application",
    targetId: created.id,
    metadata: { name: created.name, slug: created.slug },
    ipAddress: req.ip,
  });

  res.status(201).json({ application: created });
});

export const updateApplication = asyncHandler(async (req: Request, res: Response) => {
  const input = updateApplicationSchema.parse(req.body);
  const updated = await applicationsService.update(req.params.id, input);

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.APPLICATION_UPDATED,
    targetType: "Application",
    targetId: updated.id,
    metadata: { changes: input },
    ipAddress: req.ip,
  });

  res.status(200).json({ application: updated });
});

export const deleteApplication = asyncHandler(async (req: Request, res: Response) => {
  await applicationsService.remove(req.params.id);

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.APPLICATION_DELETED,
    targetType: "Application",
    targetId: req.params.id,
    ipAddress: req.ip,
  });

  res.status(204).send();
});

export const getDashboardSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await applicationsService.getDashboardSummary();
  res.status(200).json({ summary });
});
