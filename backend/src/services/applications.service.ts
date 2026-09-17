import type { ApplicationStatus } from "@prisma/client";
import { applicationRepository, type CreateApplicationInput } from "../repositories/application.repository.js";
import { ApiError } from "../utils/ApiError.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const applicationsService = {
  list() {
    return applicationRepository.list();
  },

  async getById(id: string) {
    const application = await applicationRepository.findById(id);
    if (!application) {
      throw ApiError.notFound("Application not found");
    }
    return application;
  },

  async create(input: CreateApplicationInput) {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    const existing = await applicationRepository.findBySlug(slug);
    if (existing) {
      throw ApiError.conflict(`An application with slug "${slug}" already exists`);
    }
    return applicationRepository.create({ ...input, slug });
  },

  async update(id: string, input: Partial<CreateApplicationInput>) {
    await this.getById(id); // 404s if missing
    return applicationRepository.update(id, input);
  },

  async remove(id: string) {
    await this.getById(id); // 404s if missing
    return applicationRepository.remove(id);
  },

  async getDashboardSummary() {
    const [total, enabled, byStatus] = await Promise.all([
      applicationRepository.countTotal(),
      applicationRepository.countEnabled(),
      applicationRepository.countByStatus(),
    ]);

    const statusCounts: Record<ApplicationStatus, number> = {
      ACTIVE: 0,
      DISABLED: 0,
      MAINTENANCE: 0,
      PLANNED: 0,
    };
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }

    return {
      totalApplications: total,
      enabledApplications: enabled,
      disabledApplications: total - enabled,
      byStatus: statusCounts,
    };
  },
};
