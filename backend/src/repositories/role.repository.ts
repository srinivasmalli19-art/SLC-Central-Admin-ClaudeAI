import { prisma } from "../config/prisma.js";

export const roleRepository = {
  findByName(name: string) {
    return prisma.role.findUnique({
      where: { name },
      include: { permissions: { include: { permission: true } } },
    });
  },

  findById(id: string) {
    return prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
  },

  list() {
    return prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { createdAt: "asc" },
    });
  },
};
