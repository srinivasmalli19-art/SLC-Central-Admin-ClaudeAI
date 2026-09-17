export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export type ApplicationStatus = "ACTIVE" | "DISABLED" | "MAINTENANCE" | "PLANNED";

export interface Application {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  platform?: string | null;
  environment?: string | null;
  status: ApplicationStatus;
  repositoryRef?: string | null;
  frontendUrl?: string | null;
  backendUrl?: string | null;
  integrationType?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string };
}

export interface AuditLogEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  applications: {
    totalApplications: number;
    enabledApplications: number;
    disabledApplications: number;
    byStatus: Record<ApplicationStatus, number>;
  };
  adminUsers: { total: number };
  recentAuditActivity: AuditLogEntry[];
  applicationHealth: { monitored: boolean; reason: string };
}
