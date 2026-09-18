// Explicit, allowlisted shapes returned to the Central Admin API. Every one
// of these is built field-by-field in mappers.ts from a real Firestore
// document — never a raw spread of `doc.data()`. See
// docs/JEEVAMITRA-ADAPTER.md "Data safety / DTOs" for why each field is
// included (or deliberately excluded — phone is never returned, unlike the
// Pasumithra adapter, since JeevaMitra has no existing admin-portal
// precedent to justify including it, per the Phase 5A discovery report).

export interface JeevaMitraUserSummaryDto {
  id: string;
  name: string | null;
  role: string | null;
  district: string | null;
  isVerified: boolean;
  createdAt: string | null;
}

export interface JeevaMitraDiseaseAlertDto {
  id: string;
  disease: string | null;
  affectedSpecies: string | null;
  severity: string | null;
  district: string | null;
  isActive: boolean;
  issuedAt: string | null;
}

export interface JeevaMitraDashboardSummaryDto {
  // Index signature so this DTO structurally satisfies AppAdapter's
  // `getAnalyticsSummary(): Promise<Record<string, unknown>>` — every field
  // below is still explicitly typed for real callers.
  [key: string]: unknown;
  usersByRole: {
    farmer: number;
    shepherd: number;
  };
  totalFarms: number;
  activeFarms: number;
  bookingsByStatus: {
    pending: number;
    confirmed: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  activeDiseaseAlertsBySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  activeDiseaseAlertsByDistrict: Array<{ name: string; value: number }>;
}
