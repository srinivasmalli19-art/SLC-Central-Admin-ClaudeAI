import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the Central Admin's own database only.
// This client must never be pointed at an integrated application's database —
// see docs/ARCHITECTURE.md ("no shared database across apps").
export const prisma = new PrismaClient();
