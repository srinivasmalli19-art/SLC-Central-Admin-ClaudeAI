import type { DocumentData } from "firebase-admin/firestore";
import type { JeevaMitraDiseaseAlertDto, JeevaMitraUserSummaryDto } from "./dto.js";

function toIsoStringOrNull(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// `phone` is intentionally never read or mapped here — see dto.ts.
export function toUserSummaryDto(id: string, data: DocumentData): JeevaMitraUserSummaryDto {
  return {
    id,
    name: stringOrNull(data.name),
    role: stringOrNull(data.role),
    district: stringOrNull(data.district),
    isVerified: boolOrDefault(data.isVerified, false),
    createdAt: toIsoStringOrNull(data.createdAt),
  };
}

// `symptoms`, `prevention`, `treatment`, `vetContactPhone`, `reportedBy` are
// intentionally never read or mapped here — see dto.ts and
// docs/JEEVAMITRA-ADAPTER.md "Data safety / DTOs".
export function toDiseaseAlertDto(id: string, data: DocumentData): JeevaMitraDiseaseAlertDto {
  return {
    id,
    disease: stringOrNull(data.disease),
    affectedSpecies: stringOrNull(data.affectedSpecies),
    severity: stringOrNull(data.severity),
    district: stringOrNull(data.district),
    isActive: boolOrDefault(data.isActive, false),
    issuedAt: toIsoStringOrNull(data.issuedAt),
  };
}
