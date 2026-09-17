import type { Request, Response } from "express";
import { z } from "zod";
import { adminUsersService } from "../services/adminUsers.service.js";
import { AuditAction, auditLogService } from "../services/auditLog.service.js";
import { SYSTEM_ROLES } from "../services/rbac.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createAdminUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10, "Password must be at least 10 characters"),
  name: z.string().min(1),
  roleName: z.enum([SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN]),
});

const updateRoleSchema = z.object({
  roleName: z.enum([SYSTEM_ROLES.SUPER_ADMIN, SYSTEM_ROLES.ADMIN]),
});

const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export const listAdminUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await adminUsersService.list();
  res.status(200).json({ adminUsers: users });
});

export const createAdminUser = asyncHandler(async (req: Request, res: Response) => {
  const input = createAdminUserSchema.parse(req.body);
  const created = await adminUsersService.create(input);

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.ADMIN_USER_CREATED,
    targetType: "AdminUser",
    targetId: created.id,
    metadata: { email: created.email, roleName: input.roleName },
    ipAddress: req.ip,
  });

  res.status(201).json({ adminUser: created });
});

export const updateAdminUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { roleName } = updateRoleSchema.parse(req.body);
  const updated = await adminUsersService.updateRole(req.params.id, roleName);

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.ROLE_CHANGED,
    targetType: "AdminUser",
    targetId: updated.id,
    metadata: { newRole: roleName },
    ipAddress: req.ip,
  });

  res.status(200).json({ adminUser: updated });
});

export const setAdminUserActive = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = setActiveSchema.parse(req.body);
  const updated = await adminUsersService.setActive(req.params.id, isActive);

  await auditLogService.record({
    actor: req.user,
    action: AuditAction.ADMIN_USER_UPDATED,
    targetType: "AdminUser",
    targetId: updated.id,
    metadata: { isActive },
    ipAddress: req.ip,
  });

  res.status(200).json({ adminUser: updated });
});
