import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "../utils/ApiError.js";

export const validateBody = (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw ApiError.badRequest("Validation failed", result.error.flatten().fieldErrors);
  }
  req.body = result.data;
  next();
};
