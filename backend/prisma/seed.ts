// Seeds the fixed permission catalogue, the two system roles
// (SUPER_ADMIN / ADMIN), and — only if no admin users exist yet — one
// bootstrap Super Admin account from SEED_SUPER_ADMIN_* env vars.
//
// Safe to re-run: permissions/roles are upserted, and the bootstrap admin is
// only ever created once (mirrors the one-time "/setup" pattern already used
// by Pasumithra's admin-portal for its first admin — see
// docs/APPLICATION-INVENTORY.md).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";
import { ensureSystemRolesAndPermissions } from "../src/services/rbacSeed.service.js";

async function main() {
  console.log("Seeding permissions and system roles...");
  const { superAdminRole } = await ensureSystemRolesAndPermissions();

  const existingAdminCount = await prisma.adminUser.count();
  if (existingAdminCount > 0) {
    console.log(`${existingAdminCount} admin user(s) already exist — skipping bootstrap Super Admin creation.`);
    return;
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    console.warn(
      "SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD not set — no bootstrap admin created. " +
        "Set both in backend/.env and re-run `npm run db:seed --workspace backend` to create the first Super Admin.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      roleId: superAdminRole.id,
    },
  });

  console.log(`Bootstrap Super Admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
