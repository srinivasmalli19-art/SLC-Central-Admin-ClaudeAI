// Seeds the fixed permission catalogue, the two system roles
// (SUPER_ADMIN / ADMIN), the Pasumithra and JeevaMitra application-registry
// entries, and — only if no admin users exist yet — one bootstrap Super
// Admin account from SEED_SUPER_ADMIN_* env vars.
//
// Safe to re-run: permissions/roles/the registry entry are upserted, and the
// bootstrap admin is only ever created once (mirrors the one-time "/setup"
// pattern already used by Pasumithra's admin-portal for its first admin —
// see docs/APPLICATION-INVENTORY.md).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";
import { ensureSystemRolesAndPermissions } from "../src/services/rbacSeed.service.js";

async function seedPasumithraApplication() {
  const existing = await prisma.application.findUnique({ where: { slug: "pasumithra" } });
  if (existing) {
    console.log("Pasumithra application registry entry already exists — leaving it as-is.");
    return;
  }

  await prisma.application.create({
    data: {
      name: "Pasumithra",
      slug: "pasumithra",
      description: "Livestock buy/sell marketplace — web app, admin-portal, and Capacitor mobile shell on one Firebase project.",
      platform: "React/Vite + Firebase (Firestore)",
      environment: "production",
      status: "ACTIVE",
      repositoryRef: "pasumithra-Web-application",
      frontendUrl: "https://pasumitra.com",
      backendUrl: null,
      integrationType: "adapter:pasumithra",
      enabled: true,
    },
  });
  console.log("Created Pasumithra application registry entry.");
}

// Metadata sourced only from the Phase 5A discovery report already in this
// repo's conversation history and docs/JEEVAMITRA-ADAPTER.md — no URL,
// environment, owner, or deployment detail here is invented. JeevaMitra is
// a Flutter mobile app with no public web frontend URL to record (unlike
// Pasumithra), so frontendUrl/backendUrl are left null rather than guessed.
async function seedJeevaMitraApplication() {
  const existing = await prisma.application.findUnique({ where: { slug: "jeevamitra" } });
  if (existing) {
    console.log("JeevaMitra application registry entry already exists — leaving it as-is.");
    return;
  }

  await prisma.application.create({
    data: {
      name: "JeevaMitra",
      slug: "jeevamitra",
      description:
        "Rural geo-spatial livestock and farm management platform for farmers and shepherds — land/fodder bookings, a vet directory, and community disease alerts.",
      platform: "Flutter (Android/iOS/Web/macOS/Windows) + Firebase (Firestore)",
      environment: "production",
      status: "ACTIVE",
      repositoryRef: "Jeevamitra",
      frontendUrl: null,
      backendUrl: null,
      integrationType: "adapter:jeevamitra",
      enabled: true,
    },
  });
  console.log("Created JeevaMitra application registry entry.");
}

async function main() {
  console.log("Seeding permissions and system roles...");
  const { superAdminRole } = await ensureSystemRolesAndPermissions();

  console.log("Seeding application registry entries...");
  await seedPasumithraApplication();
  await seedJeevaMitraApplication();

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
