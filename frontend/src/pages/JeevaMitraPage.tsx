import { useCallback, useEffect, useState } from "react";
import { jeevamitraApi } from "../api/jeevamitra";
import { ApiClientError } from "../api/client";
import { StatCard } from "../components/StatCard";
import type { IntegrationHealth, JeevaMitraDashboardSummary, JeevaMitraDiseaseAlert, JeevaMitraUserSummary } from "../api/types";

// Never show a raw backend error to an admin — translate the handful of
// outcomes the API can produce into plain language. The 503 branch already
// carries a sanitized message from the backend (see
// docs/JEEVAMITRA-ADAPTER.md); everything else gets a generic fallback so a
// stack trace, GCP error, or credential detail can never leak through here.
function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) {
      return "You don't have permission to view JeevaMitra data. Ask a Super Admin to grant the jeevamitra:read permission.";
    }
    if (err.status === 503) {
      return err.message;
    }
  }
  return "Something went wrong loading this section. Please try again.";
}

const HEALTH_LABELS: Record<string, string> = {
  healthy: "Healthy",
  unavailable: "Unavailable",
  configuration_error: "Configuration error",
  auth_error: "Credential error",
};

// Exact wording requested for this integration's health section — kept
// distinct from the short badge labels above.
const HEALTH_MESSAGES: Record<string, string> = {
  healthy: "JeevaMitra is connected.",
  unavailable: "JeevaMitra is currently unavailable.",
  configuration_error: "JeevaMitra integration requires configuration.",
  auth_error: "JeevaMitra integration authentication failed.",
};

const HEALTH_STYLES: Record<string, string> = {
  healthy: "bg-green-100 text-green-800",
  unavailable: "bg-red-100 text-red-700",
  configuration_error: "bg-amber-100 text-amber-800",
  auth_error: "bg-red-100 text-red-700",
};

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useSection<T>(load: () => Promise<T>): [SectionState<T>, () => void] {
  const [state, setState] = useState<SectionState<T>>({ data: null, loading: true, error: null });

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: describeError(err) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(run, [run]);

  return [state, run];
}

export function JeevaMitraPage() {
  const [health, refreshHealth] = useSection<IntegrationHealth>(() => jeevamitraApi.getHealth().then((r) => r.health));
  const [dashboard] = useSection<JeevaMitraDashboardSummary>(() => jeevamitraApi.getDashboard().then((r) => r.summary));
  const [users] = useSection<JeevaMitraUserSummary[]>(() => jeevamitraApi.listUsers().then((r) => r.users));
  const [diseaseAlerts] = useSection<JeevaMitraDiseaseAlert[]>(() =>
    jeevamitraApi.listDiseaseAlerts().then((r) => r.diseaseAlerts),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">JeevaMitra</h1>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Read only
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Live, read-only visibility into JeevaMitra via its own Firebase project. No data shown here can be edited or
        deleted from Central Admin.
      </p>

      {/* A. Health */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Firebase connectivity</h2>
          <button
            onClick={refreshHealth}
            disabled={health.loading}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {health.loading ? "Checking…" : "Recheck now"}
          </button>
        </div>

        {health.loading && !health.data && <p className="mt-3 text-sm text-slate-400">Checking connectivity…</p>}
        {health.error && <p className="mt-3 text-sm text-red-600">{health.error}</p>}
        {health.data && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  HEALTH_STYLES[health.data.status] ?? "bg-slate-200 text-slate-600"
                }`}
              >
                {HEALTH_LABELS[health.data.status] ?? health.data.status}
              </span>
              <span className="text-slate-500">Last checked: {new Date(health.data.lastCheckedAt).toLocaleString()}</span>
              {typeof health.data.responseTimeMs === "number" && (
                <span className="text-slate-400">{health.data.responseTimeMs}ms</span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {HEALTH_MESSAGES[health.data.status] ?? "JeevaMitra integration status is unknown."}
            </p>
            {health.data.status !== "healthy" && (
              <p className="mt-2 text-xs text-amber-700">
                This reflects Firebase connectivity only — it does not mean JeevaMitra itself is unhealthy or healthy.
              </p>
            )}
          </>
        )}
      </div>

      {/* B–F. Dashboard summary */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Dashboard summary</h2>
        {dashboard.loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading dashboard summary">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
            ))}
          </div>
        )}
        {dashboard.error && <p className="text-sm text-red-600">{dashboard.error}</p>}
        {dashboard.data && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Users</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Farmers" value={dashboard.data.usersByRole?.farmer ?? 0} />
                <StatCard label="Shepherds" value={dashboard.data.usersByRole?.shepherd ?? 0} />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Farms</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Farms" value={dashboard.data.totalFarms ?? 0} />
                <StatCard label="Active Farms" value={dashboard.data.activeFarms ?? 0} />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Bookings</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Pending" value={dashboard.data.bookingsByStatus?.pending ?? 0} />
                <StatCard label="Confirmed" value={dashboard.data.bookingsByStatus?.confirmed ?? 0} />
                <StatCard label="Active" value={dashboard.data.bookingsByStatus?.active ?? 0} />
                <StatCard label="Completed" value={dashboard.data.bookingsByStatus?.completed ?? 0} />
                <StatCard label="Cancelled" value={dashboard.data.bookingsByStatus?.cancelled ?? 0} />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Active Disease Alerts by Severity
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Low" value={dashboard.data.activeDiseaseAlertsBySeverity?.low ?? 0} />
                <StatCard label="Medium" value={dashboard.data.activeDiseaseAlertsBySeverity?.medium ?? 0} />
                <StatCard label="High" value={dashboard.data.activeDiseaseAlertsBySeverity?.high ?? 0} />
                <StatCard label="Critical" value={dashboard.data.activeDiseaseAlertsBySeverity?.critical ?? 0} />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Active Disease Alerts by District
              </h3>
              {(dashboard.data.activeDiseaseAlertsByDistrict?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-400">No active disease alerts recorded.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">District</th>
                        <th className="px-4 py-3">Active Alerts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboard.data.activeDiseaseAlertsByDistrict.map((row) => (
                        <tr key={row.name}>
                          <td className="px-4 py-3 text-slate-700">{row.name}</td>
                          <td className="px-4 py-3 text-slate-500">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Users table */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-800">Users (up to 50)</h2>
        {users.loading && <p className="text-sm text-slate-400">Loading users…</p>}
        {users.error && <p className="text-sm text-red-600">{users.error}</p>}
        {users.data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{user.name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{user.role ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{user.district ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.isVerified ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {user.isVerified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {users.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Disease alerts table */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-800">Disease Alerts (up to 50)</h2>
        {diseaseAlerts.loading && <p className="text-sm text-slate-400">Loading disease alerts…</p>}
        {diseaseAlerts.error && <p className="text-sm text-red-600">{diseaseAlerts.error}</p>}
        {diseaseAlerts.data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Disease</th>
                  <th className="px-4 py-3">Affected Species</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diseaseAlerts.data.map((alert) => (
                  <tr key={alert.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{alert.disease ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{alert.affectedSpecies ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{alert.severity ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{alert.district ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          alert.isActive ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {alert.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {alert.issuedAt ? new Date(alert.issuedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {diseaseAlerts.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No disease alerts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
