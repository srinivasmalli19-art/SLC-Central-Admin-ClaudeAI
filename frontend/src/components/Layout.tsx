import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", superAdminOnly: false },
  { to: "/applications", label: "Applications", superAdminOnly: false },
  // Gated the same way as "Admin Users": only SUPER_ADMIN has the
  // pasumithra:read permission by default (see docs/PASUMITHRA-ADAPTER.md
  // "RBAC"). This is a simplification — it reflects today's actual grants,
  // not a real per-permission nav check, since the frontend doesn't yet
  // fetch the current admin's full permission list (a Phase 1 gap, not new).
  { to: "/pasumithra", label: "Pasumithra", superAdminOnly: true },
  { to: "/admin-users", label: "Admin Users", superAdminOnly: true },
  { to: "/audit-logs", label: "Audit Logs", superAdminOnly: false },
  { to: "/settings", label: "Settings", superAdminOnly: false },
];

function navLinkClasses(isActive: boolean) {
  return [
    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white",
  ].join(" ");
}

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col bg-slate-900 px-3 py-6 md:flex">
        <div className="mb-8 px-3">
          <p className="text-lg font-semibold text-white">SLC Central Admin</p>
          <p className="text-xs text-slate-400">Control Plane · Phase 1</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.filter((item) => !item.superAdminOnly || user?.role === "SUPER_ADMIN").map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => navLinkClasses(isActive)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="text-sm text-slate-500 md:hidden">SLC Central Admin</div>
          <div className="ml-auto flex items-center gap-4">
            {user && (
              <div className="text-right text-sm">
                <p className="font-medium text-slate-800">{user.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">{user.role}</p>
              </div>
            )}
            <button
              onClick={() => logout()}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
