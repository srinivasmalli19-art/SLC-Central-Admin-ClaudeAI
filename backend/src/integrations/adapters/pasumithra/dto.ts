// Explicit, allowlisted shapes returned to the Central Admin API. Every one
// of these is built field-by-field in mappers.ts from a real Firestore
// document — never a raw spread of `doc.data()`. See
// docs/PASUMITHRA-ADAPTER.md "Data safety / DTOs" for why each field is
// included (or deliberately excluded, e.g. sellerPhone, imageUrls).

export interface PasumithraAdminDto {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  createdAt: string | null;
}

export interface PasumithraUserSummaryDto {
  id: string;
  name: string | null;
  phone: string | null;
  isBlocked: boolean;
  sellerVerified: boolean;
  joinedAt: string | null;
}

export interface PasumithraListingSummaryDto {
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

export interface PasumithraDashboardSummaryDto {
  // Index signature so this DTO structurally satisfies AppAdapter's
  // `getAnalyticsSummary(): Promise<Record<string, unknown>>` — every field
  // below is still explicitly typed for real callers.
  [key: string]: unknown;
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
