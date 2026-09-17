import { apiRequest } from "./client";
import type { DashboardSummary } from "./types";

export const dashboardApi = {
  get() {
    return apiRequest<DashboardSummary>("/dashboard");
  },
};
