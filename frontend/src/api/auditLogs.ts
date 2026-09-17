import { apiRequest } from "./client";
import type { AuditLogEntry } from "./types";

export const auditLogsApi = {
  list(limit = 50) {
    return apiRequest<{ auditLogs: AuditLogEntry[] }>(`/audit-logs?limit=${limit}`);
  },
};
