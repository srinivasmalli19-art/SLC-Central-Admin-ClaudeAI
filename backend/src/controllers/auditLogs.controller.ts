import type { Request, Response } from "express";
import { z } from "zod";
import { auditLogService } from "../services/auditLog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = listQuerySchema.parse(req.query);
  const auditLogs = await auditLogService.listRecent(limit);
  res.status(200).json({ auditLogs });
});
