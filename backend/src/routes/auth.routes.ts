import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/logout", requireAuth, authController.logout);
authRouter.get("/me", requireAuth, authController.me);
