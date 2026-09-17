import { Router } from "express";
import * as healthController from "../controllers/health.controller.js";

export const healthRouter = Router();

// Intentionally unauthenticated — used by uptime monitors/load balancers.
healthRouter.get("/", healthController.getHealth);
