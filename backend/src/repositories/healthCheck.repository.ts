import { prisma } from "../config/prisma.js";

export const healthCheckRepository = {
  record(data: { applicationId: string; status: string; responseTimeMs?: number; errorMessage?: string }) {
    return prisma.healthCheck.create({
      data: {
        applicationId: data.applicationId,
        status: data.status,
        responseTimeMs: data.responseTimeMs ?? null,
        errorMessage: data.errorMessage ?? null,
      },
    });
  },

  getLatestForApplication(applicationId: string) {
    return prisma.healthCheck.findFirst({
      where: { applicationId },
      orderBy: { checkedAt: "desc" },
    });
  },
};
