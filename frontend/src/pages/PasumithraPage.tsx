import { useCallback, useEffect, useState } from "react";
import { pasumithraApi } from "../api/pasumithra";
import { ApiClientError } from "../api/client";
import { StatCard } from "../components/StatCard";
import type {
  IntegrationHealth,
  PasumithraAdmin,
  PasumithraDashboardSummary,
  PasumithraListingSummary,
  PasumithraUserSummary,
} from "../api/types";

// Never show a raw backend error to an admin — translate the handful of
// outcomes the API can produce into plain language. The 503 branch already
// carries a sanitized message from the backend (see
// docs/PASUMITHRA-ADAPTER.md); everything else gets a generic fallback so a
// stack trace or Firebase internals can never leak through here either.
function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 403) {
      return "You don't have permission to view Pasumithra data. Ask a Super Admin to grant the pasumithra:read permission.";
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

export function PasumithraPage() {
  const [health, refreshHealth] = useSection<IntegrationHealth>(() => pasumithraApi.getHealth().then((r) => r.health));
  const [dashboard] = useSection<PasumithraDashboardSummary>(() => pasumithraApi.getDashboard().then((r) => r.summary));
  const [admins] = useSection<PasumithraAdmin[]>(() => pasumithraApi.listAdmins().then((r) => r.admins));
  const [users] = useSection<PasumithraUserSummary[]>(() => pasumithraApi.listUsers().then((r) => r.users));
  const [listings] = useSection<PasumithraListingSummary[]>(() => pasumithraApi.listListings().then((r) => r.listings));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Pasumithra</h1>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Read only
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Live, read-only visibility into Pasumithra via its own Firebase project. No data shown here can be edited or
        deleted from Central Admin yet.
      </p>

      {/* Connectivity */}
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
        )}
        {health.data && health.data.status !== "healthy" && (
          <p className="mt-2 text-xs text-amber-700">
            This reflects Firebase connectivity only — it does not mean Pasumithra itself is unhealthy or healthy.
          </p>
        )}
      </div>

      {/* Dashboard summary */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Dashboard summary</h2>
        {dashboard.loading && <p className="text-sm text-slate-400">Loading dashboard summary…</p>}
        {dashboard.error && <p className="text-sm text-red-600">{dashboard.error}</p>}
        {dashboard.data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Users" value={dashboard.data.totalUsers} />
            <StatCard label="Active Users" value={dashboard.data.activeUsers} />
            <StatCard label="Verified Sellers" value={dashboard.data.verifiedSellers} />
            <StatCard label="Total Listings" value={dashboard.data.totalListings} />
            <StatCard label="Active Listings" value={dashboard.data.activeListings} />
            <StatCard label="Sold Listings" value={dashboard.data.soldListings} />
            <StatCard label="Pending Reports" value={dashboard.data.pendingReports} />
            <StatCard label="New Listings Today" value={dashboard.data.newListingsToday} />
          </div>
        )}
        {dashboard.data && dashboard.data.listingsByDistrict.length === 0 && dashboard.data.totalListings === 0 && (
          <p className="mt-3 text-sm text-slate-400">No listings recorded in Pasumithra yet.</p>
        )}
      </section>

      {/* Administrators */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-800">Administrators</h2>
          <p className="text-xs text-slate-400">
            Pasumithra's own admin-portal staff — not Central Admin users. Read via a trusted server credential, never
            Pasumithra's publicly-readable rule (see docs/PASUMITHRA-ADAPTER.md).
          </p>
        </div>
        {admins.loading && <p className="text-sm text-slate-400">Loading administrators…</p>}
        {admins.error && <p className="text-sm text-red-600">{admins.error}</p>}
        {admins.data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.data.map((admin) => (
                  <tr key={admin.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{admin.name ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{admin.email ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{admin.role ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
                {admins.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No administrators found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Users */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-800">Recent users (up to 25)</h2>
        {users.loading && <p className="text-sm text-slate-400">Loading users…</p>}
        {users.error && <p className="text-sm text-red-600">{users.error}</p>}
        {users.data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.data.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{user.name ?? "Farmer"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{user.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.isBlocked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {user.isBlocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{user.sellerVerified ? "Verified" : "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : "—"}</td>
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

      {/* Listings */}
      <section>
        <h2 className="mb-2 text-base font-semibold text-slate-800">Recent listings (up to 25)</h2>
        {listings.loading && <p className="text-sm text-slate-400">Loading listings…</p>}
        {listings.error && <p className="text-sm text-red-600">{listings.error}</p>}
        {listings.data && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Posted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.data.map((listing) => (
                  <tr key={listing.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{listing.title ?? "Untitled"}</p>
                      <p className="text-xs text-slate-400">
                        {listing.category ?? "—"} · {listing.breed ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{listing.sellerName ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {listing.price != null ? `₹${listing.price.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{listing.district ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{listing.status ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {listing.postedAt ? new Date(listing.postedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {listings.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      No listings found.
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
