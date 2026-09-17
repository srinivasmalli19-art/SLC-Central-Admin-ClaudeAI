import { Router } from "express";
import * as auditLogsController from "../controllers/auditLogs.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../services/rbac.service.js";

export const auditLogsRouter = Router();

auditLogsRouter.get("/", requireAuth, requirePermission(PERMISSIONS.AUDIT_LOGS_READ), auditLogsController.listAuditLogs);
