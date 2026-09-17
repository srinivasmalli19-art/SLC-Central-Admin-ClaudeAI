import { prisma } from "../config/prisma.js";

export const adminUserRepository = {
  findByEmail(email: string) {
    return prisma.adminUser.findUnique({
      where: { email },
      include: { role: true },
    });
  },

  findById(id: string) {
    return prisma.adminUser.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
  },

  list() {
    return prisma.adminUser.findMany({
      include: { role: true },
      orderBy: { createdAt: "asc" },
    });
  },

  create(data: { email: string; passwordHash: string; name: string; roleId: string }) {
    return prisma.adminUser.create({ data, include: { role: true } });
  },

  update(id: string, data: Partial<{ name: string; roleId: string; isActive: boolean; passwordHash: string }>) {
    return prisma.adminUser.update({ where: { id }, data, include: { role: true } });
  },

  touchLastLogin(id: string) {
    return prisma.adminUser.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  count() {
    return prisma.adminUser.count();
  },
};
