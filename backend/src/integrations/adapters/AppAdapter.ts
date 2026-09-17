// Common interface every future per-application integration adapter will
// implement (see docs/ARCHITECTURE.md "Integration Adapter Layer"). This is
// Phase 1 SCAFFOLDING ONLY — no concrete adapter (Pasumithra, JeevaMitra,
// etc.) is implemented yet, and none of this is wired into any route.
// Implementing a real adapter is Phase 4+ work (docs/ROADMAP.md).
//
// A real adapter would hold that application's own credentials (a Firebase
// service account, a Supabase service-role key, etc.) privately, loaded only
// from this backend's environment/secrets — never from a repo, never sent
// to the frontend. See docs/INTEGRATION-STRATEGY.md "Credential handling
// rules".

export interface HealthStatus {
  status: "up" | "down" | "unknown";
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
