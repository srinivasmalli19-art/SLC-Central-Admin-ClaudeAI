import { Router } from "express";
import * as adminUsersController from "../controllers/adminUsers.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../services/rbac.service.js";

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE));

adminUsersRouter.get("/", adminUsersController.listAdminUsers);
adminUsersRouter.post("/", adminUsersController.createAdminUser);
adminUsersRouter.patch("/:id/role", adminUsersController.updateAdminUserRole);
adminUsersRouter.patch("/:id/active", adminUsersController.setAdminUserActive);
