import { adminUserRepository } from "../repositories/adminUser.repository.js";
import { roleRepository } from "../repositories/role.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword } from "../utils/password.js";

export const adminUsersService = {
  async list() {
    const users = await adminUserRepository.list();
    return users.map(toSafeAdminUser);
  },

  async create(input: { email: string; password: string; name: string; roleName: string }) {
    const existing = await adminUserRepository.findByEmail(input.email.toLowerCase().trim());
    if (existing) {
      throw ApiError.conflict("An admin user with this email already exists");
    }

    const role = await roleRepository.findByName(input.roleName);
    if (!role) {
      throw ApiError.badRequest(`Unknown role: ${input.roleName}`);
    }

    const passwordHash = await hashPassword(input.password);
    const created = await adminUserRepository.create({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name,
      roleId: role.id,
    });

    return toSafeAdminUser(created);
  },

  async updateRole(id: string, roleName: string) {
    const role = await roleRepository.findByName(roleName);
    if (!role) {
      throw ApiError.badRequest(`Unknown role: ${roleName}`);
    }
    const updated = await adminUserRepository.update(id, { roleId: role.id });
    return toSafeAdminUser(updated);
  },

  async setActive(id: string, isActive: boolean) {
    const updated = await adminUserRepository.update(id, { isActive });
    return toSafeAdminUser(updated);
  },
};

// Never return passwordHash to any API response.
function toSafeAdminUser<T extends { passwordHash: string; role: { name: string } }>(user: T) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
