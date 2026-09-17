import { apiRequest } from "./client";
import type {
  IntegrationHealth,
  PasumithraAdmin,
  PasumithraDashboardSummary,
  PasumithraListingSummary,
  PasumithraUserSummary,
} from "./types";

// Every call here is read-only — this module intentionally has no
// create/update/delete functions (Phase 4 scope; see docs/PASUMITHRA-ADAPTER.md).
export const pasumithraApi = {
  getHealth() {
    return apiRequest<{ health: IntegrationHealth }>("/pasumithra/health");
  },
  getDashboard() {
    return apiRequest<{ summary: PasumithraDashboardSummary }>("/pasumithra/dashboard");
  },
  listAdmins() {
    return apiRequest<{ admins: PasumithraAdmin[] }>("/pasumithra/admins");
  },
  listUsers(limit = 25) {
    return apiRequest<{ users: PasumithraUserSummary[] }>(`/pasumithra/users?limit=${limit}`);
  },
  listListings(limit = 25) {
    return apiRequest<{ listings: PasumithraListingSummary[] }>(`/pasumithra/listings?limit=${limit}`);
  },
};
