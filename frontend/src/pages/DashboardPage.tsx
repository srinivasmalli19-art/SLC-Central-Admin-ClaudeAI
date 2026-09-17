import { useEffect, useState } from "react";
import { dashboardApi } from "../api/dashboard";
import type { DashboardSummary } from "../api/types";
import { StatCard } from "../components/StatCard";

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi
      .get()
      .then(setSummary)
      .catch(() => setError("Failed to load dashboard data."));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered Applications" value={summary.applications.totalApplications} />
        <StatCard label="Enabled Applications" value={summary.applications.enabledApplications} />
        <StatCard label="Disabled Applications" value={summary.applications.disabledApplications} />
        <StatCard label="Admin Users" value={summary.adminUsers.total} />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Application health:</strong> {summary.applicationHealth.reason}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Recent Audit Activity</h2>
        {summary.recentAuditActivity.length === 0 ? (
          <p className="text-sm text-slate-500">No audit activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {summary.recentAuditActivity.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-700">{entry.action}</span>
                  {entry.actorEmail && <span className="ml-2 text-slate-400">by {entry.actorEmail}</span>}
                </div>
                <span className="text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
