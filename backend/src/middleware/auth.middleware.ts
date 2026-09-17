import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import type { AuthenticatedPrincipal } from "../services/auth/AuthProvider.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedPrincipal;
    }
  }
}

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing or malformed Authorization header");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  req.user = await authService.verifyToken(token);
  next();
});
