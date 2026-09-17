import { adminUserRepository } from "../repositories/adminUser.repository.js";
import { applicationsService } from "./applications.service.js";
import { auditLogService } from "./auditLog.service.js";

export const dashboardService = {
  async getSummary() {
    const [applicationSummary, adminUserCount, recentAuditLogs] = await Promise.all([
      applicationsService.getDashboardSummary(),
      adminUserRepository.count(),
      auditLogService.listRecent(10),
    ]);

    return {
      applications: applicationSummary,
      adminUsers: { total: adminUserCount },
      recentAuditActivity: recentAuditLogs,
      // No adapter exists yet (Phase 1) — every registered application is
      // reported as "not monitored" rather than guessing a health status.
      applicationHealth: { monitored: false, reason: "No integration adapters exist yet (see docs/ROADMAP.md Phase 4+)." },
    };
  },
};
