import { useEffect, useState, type FormEvent } from "react";
import { applicationsApi } from "../api/applications";
import { ApiClientError } from "../api/client";
import type { Application, ApplicationStatus } from "../api/types";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  DISABLED: "bg-slate-200 text-slate-600",
  MAINTENANCE: "bg-amber-100 text-amber-800",
  PLANNED: "bg-blue-100 text-blue-800",
};

export function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function refresh() {
    applicationsApi
      .list()
      .then((res) => setApplications(res.applications))
      .catch(() => setError("Failed to load applications."));
  }

  useEffect(refresh, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await applicationsApi.create({ name, platform: platform || undefined, status: "PLANNED" });
      setName("");
      setPlatform("");
      refresh();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to create application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleEnabled(app: Application) {
    await applicationsApi.update(app.id, { enabled: !app.enabled });
    refresh();
  }

  async function remove(app: Application) {
    if (!window.confirm(`Remove "${app.name}" from the registry?`)) return;
    await applicationsApi.remove(app.id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Application Registry</h1>

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="e.g. Pasumithra"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Platform</label>
          <input
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="e.g. React/Vite + Firebase"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Add application
        </button>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applications.map((app) => (
              <tr key={app.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{app.name}</td>
                <td className="px-4 py-3 text-slate-500">{app.platform ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[app.status]}`}>
                    {app.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleEnabled(app)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      app.enabled ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {app.enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(app)} className="text-xs font-medium text-red-600 hover:underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No applications registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
