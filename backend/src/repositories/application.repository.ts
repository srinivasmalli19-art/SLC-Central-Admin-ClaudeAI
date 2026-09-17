import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export interface CreateApplicationInput {
  name: string;
  slug?: string;
  description?: string;
  platform?: string;
  environment?: string;
  status?: ApplicationStatus;
  repositoryRef?: string;
  frontendUrl?: string;
  backendUrl?: string;
  integrationType?: string;
  enabled?: boolean;
}

export const applicationRepository = {
  list() {
    return prisma.application.findMany({ orderBy: { name: "asc" } });
  },

  findById(id: string) {
    return prisma.application.findUnique({ where: { id } });
  },

  findBySlug(slug: string) {
    return prisma.application.findUnique({ where: { slug } });
  },

  create(data: CreateApplicationInput & { slug: string }) {
    return prisma.application.create({ data });
  },

  update(id: string, data: Partial<CreateApplicationInput>) {
    return prisma.application.update({ where: { id }, data: data as Prisma.ApplicationUpdateInput });
  },

  remove(id: string) {
    return prisma.application.delete({ where: { id } });
  },

  countByStatus() {
    return prisma.application.groupBy({ by: ["status"], _count: { _all: true } });
  },

  countEnabled() {
    return prisma.application.count({ where: { enabled: true } });
  },

  countTotal() {
    return prisma.application.count();
  },
};
