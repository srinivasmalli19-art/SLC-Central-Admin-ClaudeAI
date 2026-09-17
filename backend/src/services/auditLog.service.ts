import type { Prisma } from "@prisma/client";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import type { AuthenticatedPrincipal } from "./auth/AuthProvider.js";

export const AuditAction = {
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  ADMIN_USER_CREATED: "ADMIN_USER_CREATED",
  ADMIN_USER_UPDATED: "ADMIN_USER_UPDATED",
  ROLE_CHANGED: "ROLE_CHANGED",
  APPLICATION_CREATED: "APPLICATION_CREATED",
  APPLICATION_UPDATED: "APPLICATION_UPDATED",
  APPLICATION_DELETED: "APPLICATION_DELETED",
  // Generic across every integration adapter (Pasumithra, and future
  // JeevaMitra/NearSip/etc. adapters reuse these same two actions) — the
  // specific app is identified in metadata.applicationSlug, not the action
  // name, so adding a new adapter never means adding a new audit action.
  INTEGRATION_HEALTH_CHECKED: "INTEGRATION_HEALTH_CHECKED",
  INTEGRATION_DATA_ACCESSED: "INTEGRATION_DATA_ACCESSED",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

interface RecordActionInput {
  actor?: AuthenticatedPrincipal | null;
  action: AuditActionType;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

// A denylist of key names that must never end up in audit metadata, as a
// defensive backstop — callers should never pass these in the first place.
const FORBIDDEN_METADATA_KEYS = ["password", "passwordHash", "token", "secret", "jwt", "serviceAccount", "apiKey"];

function sanitizeMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.some((forbidden) => lowerKey.includes(forbidden.toLowerCase()))) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

export const auditLogService = {
  async record(input: RecordActionInput) {
    await auditLogRepository.record({
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: (sanitizeMetadata(input.metadata) ?? null) as Prisma.InputJsonValue | null,
      ipAddress: input.ipAddress ?? null,
    });
  },

  listRecent(limit?: number) {
    return auditLogRepository.listRecent(limit);
  },
};
