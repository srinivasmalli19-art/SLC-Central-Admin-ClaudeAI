import { roleRepository } from "../repositories/role.repository.js";

// Fixed permission catalogue for Phase 1. Adding a permission later means
// adding a key here + a migration/seed row — authorization logic in
// rbac.middleware.ts never needs to change.
export const PERMISSIONS = {
  ADMIN_USERS_MANAGE: "admin_users:manage",
  ROLES_MANAGE: "roles:manage",
  APPLICATIONS_READ: "applications:read",
  APPLICATIONS_MANAGE: "applications:manage",
  AUDIT_LOGS_READ: "audit_logs:read",
  DASHBOARD_READ: "dashboard:read",
  PASUMITHRA_READ: "pasumithra:read",
  JEEVAMITRA_READ: "jeevamitra:read",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
} as const;

// SUPER_ADMIN has implicit access to everything, by design (see
// docs/ARCHITECTURE.md RBAC section) — it is not granted permissions
// individually so that adding a new permission never requires remembering
// to also grant it to SUPER_ADMIN.
export async function roleHasPermission(roleName: string, permissionKey: PermissionKey): Promise<boolean> {
  if (roleName === SYSTEM_ROLES.SUPER_ADMIN) {
    return true;
  }

  const role = await roleRepository.findByName(roleName);
  if (!role) return false;

  return role.permissions.some((rolePermission) => rolePermission.permission.key === permissionKey);
}
