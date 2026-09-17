import { useEffect, useState, type FormEvent } from "react";
import { adminUsersApi } from "../api/adminUsers";
import { ApiClientError } from "../api/client";
import type { AdminUser } from "../api/types";

export function AdminUsersPage() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState<"SUPER_ADMIN" | "ADMIN">("ADMIN");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function refresh() {
    adminUsersApi
      .list()
      .then((res) => setAdminUsers(res.adminUsers))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load admin users."));
  }

  useEffect(refresh, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await adminUsersApi.create({ email, name, password, roleName });
      setEmail("");
      setName("");
      setPassword("");
      refresh();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to create admin user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    await adminUsersApi.setActive(user.id, !user.isActive);
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Admin Users</h1>
      <p className="text-sm text-slate-500">
        Central Admin staff accounts only — completely separate from any integrated application's own users.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500">Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Password</label>
          <input
            required
            type="password"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Role</label>
          <select
            value={roleName}
            onChange={(e) => setRoleName(e.target.value as "SUPER_ADMIN" | "ADMIN")}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Create admin user
        </button>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adminUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                <td className="px-4 py-3 text-slate-500">{user.email}</td>
                <td className="px-4 py-3 text-slate-500">{user.role.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.isActive ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(user)} className="text-xs font-medium text-brand-600 hover:underline">
                    {user.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
            {adminUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No admin users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
