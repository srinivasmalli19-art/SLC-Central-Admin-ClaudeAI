import { apiRequest } from "./client";
import type { AdminUser } from "./types";

export const adminUsersApi = {
  list() {
    return apiRequest<{ adminUsers: AdminUser[] }>("/admin-users");
  },
  create(input: { email: string; password: string; name: string; roleName: "SUPER_ADMIN" | "ADMIN" }) {
    return apiRequest<{ adminUser: AdminUser }>("/admin-users", { method: "POST", body: input });
  },
  updateRole(id: string, roleName: "SUPER_ADMIN" | "ADMIN") {
    return apiRequest<{ adminUser: AdminUser }>(`/admin-users/${id}/role`, { method: "PATCH", body: { roleName } });
  },
  setActive(id: string, isActive: boolean) {
    return apiRequest<{ adminUser: AdminUser }>(`/admin-users/${id}/active`, { method: "PATCH", body: { isActive } });
  },
};
