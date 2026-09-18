import { getJeevaMitraAdapter } from "../../integrations/adapters/jeevamitra/index.js";
import { JeevaMitraUnavailableError } from "../../integrations/adapters/jeevamitra/jeevamitraAdapter.js";
import { applicationRepository } from "../../repositories/application.repository.js";
import { healthCheckRepository } from "../../repositories/healthCheck.repository.js";
import { logger } from "../../config/logger.js";
import { ApiError } from "../../utils/ApiError.js";

// Thin orchestration layer between the jeevamitra controller and the
// JeevaMitra adapter — mirrors backend/src/services/integrations/pasumithra.service.ts
// exactly. Persists health-check results against the application-registry
// row (if one exists — the adapter itself works independently of the
// registry), and turns JeevaMitraUnavailableError into the ApiError shape
// the rest of the API already uses.
async function persistHealthCheck(status: string, responseTimeMs?: number, errorMessage?: string) {
  try {
    const application = await applicationRepository.findBySlug("jeevamitra");
    if (!application) {
      logger.warn(
        "No 'jeevamitra' application registry row found — health check result was not persisted. " +
          "Add JeevaMitra to the Application Registry to enable 'last health check' history.",
      );
      return;
    }
    await healthCheckRepository.record({ applicationId: application.id, status, responseTimeMs, errorMessage });
  } catch (err) {
    // Persisting health-check history is a convenience, not a correctness
    // requirement — never fail the actual health check response because of
    // a Postgres write issue.
    logger.warn({ err }, "Failed to persist JeevaMitra health check result");
  }
}

function toServiceUnavailable(err: unknown): ApiError {
  if (err instanceof JeevaMitraUnavailableError) {
    return ApiError.serviceUnavailable("JeevaMitra integration is not reachable right now.", { code: err.code });
  }
  throw err;
}

export const jeevamitraIntegrationService = {
  async checkHealth() {
    const adapter = getJeevaMitraAdapter();
    const health = await adapter.getHealth();
    await persistHealthCheck(health.status, health.responseTimeMs, health.errorMessage);
    return health;
  },

  async getDashboardSummary() {
    try {
      return await getJeevaMitraAdapter().getAnalyticsSummary();
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },

  async listUsers(params: { limit?: number }) {
    try {
      return await getJeevaMitraAdapter().listUsers(params);
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },

  async listDiseaseAlerts(params: { limit?: number; isActive?: boolean }) {
    try {
      return await getJeevaMitraAdapter().listEntities("disease_alerts", params);
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },
};
