import { Router } from "express";
import * as jeevamitraController from "../controllers/jeevamitra.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { PERMISSIONS } from "../services/rbac.service.js";

export const jeevamitraRouter = Router();

// Every route is read-only (GET) and requires the dedicated jeevamitra:read
// permission — see docs/JEEVAMITRA-ADAPTER.md "RBAC". No write/mutation
// route exists in this router by design (Phase 5B scope). Farms, bookings,
// vets, conversations/messages, and Storage are deliberately not exposed —
// see docs/JEEVAMITRA-ADAPTER.md "Deferred scope".
jeevamitraRouter.use(requireAuth, requirePermission(PERMISSIONS.JEEVAMITRA_READ));

jeevamitraRouter.get("/health", jeevamitraController.getHealth);
jeevamitraRouter.get("/dashboard", jeevamitraController.getDashboard);
jeevamitraRouter.get("/users", jeevamitraController.listUsers);
jeevamitraRouter.get("/disease-alerts", jeevamitraController.listDiseaseAlerts);
