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

// --- Pasumithra integration (Phase 4, read-only) ---

export type IntegrationHealthStatus = "healthy" | "unavailable" | "configuration_error" | "auth_error";

export interface IntegrationHealth {
  status: IntegrationHealthStatus;
  responseTimeMs?: number;
  lastCheckedAt: string;
  errorMessage?: string;
}

export interface PasumithraAdmin {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  createdAt: string | null;
}

export interface PasumithraUserSummary {
  id: string;
  name: string | null;
  phone: string | null;
  isBlocked: boolean;
  sellerVerified: boolean;
  joinedAt: string | null;
}

export interface PasumithraListingSummary {
  id: string;
  title: string | null;
  category: string | null;
  breed: string | null;
  district: string | null;
  price: number | null;
  status: string | null;
  sellerName: string | null;
  postedAt: string | null;
}

export interface PasumithraDashboardSummary {
  totalUsers: number;
  activeUsers: number;
  verifiedSellers: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalHealthRecords: number;
  pendingReports: number;
  newListingsToday: number;
  upcomingVaccinations: number;
  upcomingDeworming: number;
  pregnantAnimals: number;
  upcomingCalving: number;
  reportedListings: number;
  reportedSellers: number;
  pendingVerifications: number;
  listingsByCategory: Array<{ name: string; value: number }>;
  listingsByDistrict: Array<{ name: string; value: number }>;
}
