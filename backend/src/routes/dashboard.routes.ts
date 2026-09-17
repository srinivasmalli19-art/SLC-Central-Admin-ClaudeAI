import { Router } from "express";
import * as dashboardController from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../services/rbac.service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, requirePermission(PERMISSIONS.DASHBOARD_READ), dashboardController.getDashboard);
