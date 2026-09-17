import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await dashboardService.getSummary();
  res.status(200).json(summary);
});
