import { getPasumithraAdapter } from "../../integrations/adapters/pasumithra/index.js";
import { PasumithraUnavailableError } from "../../integrations/adapters/pasumithra/pasumithraAdapter.js";
import { applicationRepository } from "../../repositories/application.repository.js";
import { healthCheckRepository } from "../../repositories/healthCheck.repository.js";
import { logger } from "../../config/logger.js";
import { ApiError } from "../../utils/ApiError.js";

// Thin orchestration layer between the pasumithra controller and the
// Pasumithra adapter: persists health-check results against the
// application-registry row (if one exists — the adapter itself works
// independently of the registry, see docs/PASUMITHRA-ADAPTER.md), and turns
// PasumithraUnavailableError into the ApiError shape the rest of the API
// already uses, so the controller layer stays uniform.
async function persistHealthCheck(status: string, responseTimeMs?: number, errorMessage?: string) {
  try {
    const application = await applicationRepository.findBySlug("pasumithra");
    if (!application) {
      logger.warn(
        "No 'pasumithra' application registry row found — health check result was not persisted. " +
          "Add Pasumithra to the Application Registry to enable 'last health check' history.",
      );
      return;
    }
    await healthCheckRepository.record({ applicationId: application.id, status, responseTimeMs, errorMessage });
  } catch (err) {
    // Persisting health-check history is a convenience, not a correctness
    // requirement — never fail the actual health check response because of
    // a Postgres write issue.
    logger.warn({ err }, "Failed to persist Pasumithra health check result");
  }
}

function toServiceUnavailable(err: unknown): ApiError {
  if (err instanceof PasumithraUnavailableError) {
    return ApiError.serviceUnavailable("Pasumithra integration is not reachable right now.", { code: err.code });
  }
  throw err;
}

export const pasumithraIntegrationService = {
  async checkHealth() {
    const adapter = getPasumithraAdapter();
    const health = await adapter.getHealth();
    await persistHealthCheck(health.status, health.responseTimeMs, health.errorMessage);
    return health;
  },

  async getDashboardSummary() {
    try {
      return await getPasumithraAdapter().getAnalyticsSummary();
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },

  async listAdmins() {
    try {
      return await getPasumithraAdapter().listAdmins();
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },

  async listUsers(params: { limit?: number }) {
    try {
      return await getPasumithraAdapter().listUsers(params);
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },

  async listListings(params: { limit?: number; status?: string }) {
    try {
      return await getPasumithraAdapter().listEntities("listings", params);
    } catch (err) {
      throw toServiceUnavailable(err);
    }
  },
};
