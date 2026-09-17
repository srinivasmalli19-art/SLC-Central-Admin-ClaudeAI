import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export interface RecordAuditLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

export const auditLogRepository = {
  record(data: RecordAuditLogInput) {
    return prisma.auditLog.create({ data: data as Prisma.AuditLogUncheckedCreateInput });
  },

  listRecent(limit = 50) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
