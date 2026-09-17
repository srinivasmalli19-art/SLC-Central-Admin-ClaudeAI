import { Router } from "express";
import * as applicationsController from "../controllers/applications.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../services/rbac.service.js";

export const applicationsRouter = Router();

applicationsRouter.use(requireAuth);

applicationsRouter.get("/", requirePermission(PERMISSIONS.APPLICATIONS_READ), applicationsController.listApplications);
applicationsRouter.get("/:id", requirePermission(PERMISSIONS.APPLICATIONS_READ), applicationsController.getApplication);
applicationsRouter.post("/", requirePermission(PERMISSIONS.APPLICATIONS_MANAGE), applicationsController.createApplication);
applicationsRouter.patch("/:id", requirePermission(PERMISSIONS.APPLICATIONS_MANAGE), applicationsController.updateApplication);
applicationsRouter.delete("/:id", requirePermission(PERMISSIONS.APPLICATIONS_MANAGE), applicationsController.deleteApplication);
