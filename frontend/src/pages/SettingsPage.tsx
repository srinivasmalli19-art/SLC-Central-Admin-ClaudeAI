import { useAuth } from "../context/AuthContext";

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">Your account</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd className="font-medium text-slate-800">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-800">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium text-slate-800">{user?.role}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
        Platform-wide settings (e.g. notification preferences, integration defaults) are not part of
        Phase 1 — see <code>docs/ROADMAP.md</code> for when this section grows.
      </div>
    </div>
  );
}
