import { prisma } from "../config/prisma.js";
import { SYSTEM_ROLES } from "./rbac.service.js";

// Shared by prisma/seed.ts (real dev/prod seeding) and the test suite
// (tests/helpers/db.ts), so the permission catalogue only lives in one place.
export const PERMISSION_CATALOGUE = [
  { key: "admin_users:manage", description: "Create/update Central Admin staff accounts and roles" },
  { key: "roles:manage", description: "Manage roles and permissions" },
  { key: "applications:read", description: "View the application registry" },
  { key: "applications:manage", description: "Create/update/delete application registry entries" },
  { key: "audit_logs:read", description: "View the audit log" },
  { key: "dashboard:read", description: "View the dashboard" },
  // Dedicated, app-specific read permission (Phase 4) — deliberately NOT in
  // ADMIN_DEFAULT_PERMISSIONS below, so granting Pasumithra visibility is a
  // conscious Super Admin action per admin user, not an automatic blanket
  // grant to every ADMIN. See docs/PASUMITHRA-ADAPTER.md "RBAC".
  { key: "pasumithra:read", description: "View read-only Pasumithra integration data (dashboard, users, listings, admins)" },
  // Same rationale as pasumithra:read — deliberately NOT in
  // ADMIN_DEFAULT_PERMISSIONS. See docs/JEEVAMITRA-ADAPTER.md "RBAC".
  { key: "jeevamitra:read", description: "View read-only JeevaMitra integration data (dashboard, users, disease alerts)" },
];

// SUPER_ADMIN gets implicit access to everything in code (rbac.service.ts) —
// no explicit RolePermission rows are created for it.
export const ADMIN_DEFAULT_PERMISSIONS = ["applications:read", "audit_logs:read", "dashboard:read"];

export async function ensureSystemRolesAndPermissions() {
  for (const permission of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const superAdminRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.SUPER_ADMIN },
    update: {},
    create: {
      name: SYSTEM_ROLES.SUPER_ADMIN,
      description: "Full access to everything, including managing other admins and the application registry.",
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: SYSTEM_ROLES.ADMIN },
    update: {},
    create: {
      name: SYSTEM_ROLES.ADMIN,
      description: "Scoped access to applications, audit logs, and the dashboard. Cannot manage other admin accounts.",
      isSystem: true,
    },
  });

  for (const key of ADMIN_DEFAULT_PERMISSIONS) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  return { superAdminRole, adminRole };
}
