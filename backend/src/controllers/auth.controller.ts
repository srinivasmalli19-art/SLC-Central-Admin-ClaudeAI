import type { Request, Response } from "express";
import { z } from "zod";
import { authService } from "../services/auth.service.js";
import { AuditAction, auditLogService } from "../services/auditLog.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  try {
    const result = await authService.login(email, password);
    await auditLogService.record({
      actor: result.user,
      action: AuditAction.LOGIN,
      targetType: "AdminUser",
      targetId: result.user.id,
      ipAddress: req.ip,
    });
    res.status(200).json(result);
  } catch (err) {
    // Record the failed attempt without leaking whether the email exists.
    await auditLogService.record({
      action: AuditAction.LOGIN_FAILED,
      targetType: "AdminUser",
      metadata: { attemptedEmail: email },
      ipAddress: req.ip,
    });
    throw err;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  // JWTs are stateless in Phase 1 — there is no server-side session to
  // revoke; the client is responsible for discarding the token. We still
  // record the event for the audit trail.
  await auditLogService.record({
    actor: req.user,
    action: AuditAction.LOGOUT,
    targetType: "AdminUser",
    targetId: req.user.id,
    ipAddress: req.ip,
  });
  res.status(204).send();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  res.status(200).json({ user: req.user });
});
