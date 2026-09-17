import type { NextFunction, Request, Response } from "express";
import { roleHasPermission, type PermissionKey } from "../services/rbac.service.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Must run after requireAuth (needs req.user to already be set).
export const requirePermission = (permissionKey: PermissionKey) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    const allowed = await roleHasPermission(req.user.role, permissionKey);
    if (!allowed) {
      throw ApiError.forbidden(`Missing required permission: ${permissionKey}`);
    }

    next();
  });
