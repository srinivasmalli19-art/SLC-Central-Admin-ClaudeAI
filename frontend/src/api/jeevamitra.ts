import { apiRequest } from "./client";
import type { IntegrationHealth, JeevaMitraDashboardSummary, JeevaMitraDiseaseAlert, JeevaMitraUserSummary } from "./types";

// Every call here is read-only — this module intentionally has no
// create/update/delete functions (Phase 5B/5C scope; see
// docs/JEEVAMITRA-ADAPTER.md). Only GET requests are ever made; there is no
// POST/PUT/PATCH/DELETE call anywhere in this file.
export const jeevamitraApi = {
  getHealth() {
    return apiRequest<{ health: IntegrationHealth }>("/jeevamitra/health");
  },
  getDashboard() {
    return apiRequest<{ summary: JeevaMitraDashboardSummary }>("/jeevamitra/dashboard");
  },
  listUsers(limit = 50) {
    return apiRequest<{ users: JeevaMitraUserSummary[] }>(`/jeevamitra/users?limit=${limit}`);
  },
  listDiseaseAlerts(limit = 50) {
    return apiRequest<{ diseaseAlerts: JeevaMitraDiseaseAlert[] }>(`/jeevamitra/disease-alerts?limit=${limit}`);
  },
};
