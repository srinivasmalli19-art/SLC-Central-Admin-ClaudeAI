// Common interface every per-application integration adapter implements
// (see docs/ARCHITECTURE.md "Integration Adapter Layer"). The first concrete
// implementation is backend/src/integrations/adapters/pasumithra/ (Phase 4,
// read-only) — see docs/PASUMITHRA-ADAPTER.md for the integration record.
//
// A real adapter holds that application's own credentials (a Firebase
// service account, a Supabase service-role key, etc.) privately, loaded only
// from this backend's environment/secrets — never from a repo, never sent
// to the frontend. See docs/INTEGRATION-STRATEGY.md "Credential handling
// rules".

// Generic across every adapter, not Pasumithra-specific — any adapter can
// fail in one of these four distinct ways, and the frontend/API should
// always be able to tell them apart rather than collapsing everything to a
// single "down":
//   healthy             — a real read against the app's backend succeeded.
//   unavailable         — the backend was unreachable (network/timeout), or
//                         the failure didn't match a known auth/config
//                         pattern (the safe default — never report healthy
//                         on an error that couldn't be positively classified).
//   configuration_error — this adapter's own required env vars are missing
//                         or malformed. Detected before any network call.
//   auth_error          — the backend rejected the configured credential
//                         (invalid/expired/insufficiently-privileged).
export type HealthCheckStatus = "healthy" | "unavailable" | "configuration_error" | "auth_error";

export interface HealthStatus {
  status: HealthCheckStatus;
  responseTimeMs?: number;
  lastCheckedAt: string;
  errorMessage?: string;
}

export interface AppMeta {
  slug: string;
  name: string;
}

export interface AppAdapter {
  getInfo(): AppMeta;
  getHealth(): Promise<HealthStatus>;

  // Every capability below is optional — not every integrated app supports
  // every operation, and no adapter is required to implement all of them.
  listUsers?(params?: Record<string, unknown>): Promise<unknown[]>;
  getUser?(id: string): Promise<unknown>;
  updateUserStatus?(id: string, status: string): Promise<void>;
  listEntities?(entityType: string, params?: Record<string, unknown>): Promise<unknown[]>;
  getAnalyticsSummary?(): Promise<Record<string, unknown>>;
}
