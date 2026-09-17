import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { isProduction } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: "Validation failed", details: err.flatten().fieldErrors } });
    return;
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, "Unhandled server error");
    }
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }

  logger.error({ err }, "Unexpected error");
  res.status(500).json({
    error: {
      message: "Internal server error",
      // Never leak stack traces / internals in production responses.
      ...(isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
