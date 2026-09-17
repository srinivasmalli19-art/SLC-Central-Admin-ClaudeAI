import bcrypt from "bcryptjs";
import { prisma } from "../../src/config/prisma.js";
import { ensureSystemRolesAndPermissions } from "../../src/services/rbacSeed.service.js";
import { SYSTEM_ROLES } from "../../src/services/rbac.service.js";

// Deletes everything the tests could have created, but leaves the
// SUPER_ADMIN/ADMIN roles and permission catalogue in place (those are
// static fixtures, re-upserted idempotently by ensureFixtures()).
export async function resetMutableData() {
  await prisma.auditLog.deleteMany();
  await prisma.healthCheck.deleteMany();
  await prisma.application.deleteMany();
  await prisma.adminUser.deleteMany();
}

export async function ensureFixtures() {
  return ensureSystemRolesAndPermissions();
}

export async function createTestAdminUser(opts: {
  email: string;
  password: string;
  name?: string;
  roleName?: string;
  isActive?: boolean;
}) {
  const { superAdminRole, adminRole } = await ensureFixtures();
  const role = opts.roleName === SYSTEM_ROLES.ADMIN ? adminRole : superAdminRole;

  const passwordHash = await bcrypt.hash(opts.password, 4); // low cost factor — tests only
  return prisma.adminUser.create({
    data: {
      email: opts.email.toLowerCase(),
      passwordHash,
      name: opts.name ?? "Test User",
      roleId: role.id,
      isActive: opts.isActive ?? true,
    },
    include: { role: true },
  });
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
