import { useEffect, useState } from "react";
import { auditLogsApi } from "../api/auditLogs";
import type { AuditLogEntry } from "../api/types";

export function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auditLogsApi
      .list(100)
      .then((res) => setAuditLogs(res.auditLogs))
      .catch(() => setError("Failed to load audit logs."));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-700">{entry.actorEmail ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{entry.action}</td>
                <td className="px-4 py-3 text-slate-500">
                  {entry.targetType ? `${entry.targetType}${entry.targetId ? ` (${entry.targetId.slice(0, 8)}…)` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-400">{entry.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {auditLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No audit activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
