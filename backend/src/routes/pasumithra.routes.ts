import { Router } from "express";
import * as pasumithraController from "../controllers/pasumithra.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../services/rbac.service.js";

export const pasumithraRouter = Router();

// Every route is read-only (GET) and requires the dedicated pasumithra:read
// permission — see docs/PASUMITHRA-ADAPTER.md "RBAC". No write/mutation
// route exists in this router by design (Phase 4 scope).
pasumithraRouter.use(requireAuth, requirePermission(PERMISSIONS.PASUMITHRA_READ));

pasumithraRouter.get("/health", pasumithraController.getHealth);
pasumithraRouter.get("/dashboard", pasumithraController.getDashboard);
pasumithraRouter.get("/admins", pasumithraController.listAdmins);
pasumithraRouter.get("/users", pasumithraController.listUsers);
pasumithraRouter.get("/listings", pasumithraController.listListings);
