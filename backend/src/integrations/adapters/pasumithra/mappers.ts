import type { DocumentData } from "firebase-admin/firestore";
import type { PasumithraAdminDto, PasumithraListingSummaryDto, PasumithraUserSummaryDto } from "./dto.js";

function toIsoStringOrNull(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function toAdminDto(id: string, data: DocumentData): PasumithraAdminDto {
  return {
    id,
    email: stringOrNull(data.email),
    name: stringOrNull(data.name),
    role: stringOrNull(data.role),
    createdAt: toIsoStringOrNull(data.createdAt),
  };
}

export function toUserSummaryDto(id: string, data: DocumentData): PasumithraUserSummaryDto {
  return {
    id,
    name: stringOrNull(data.name),
    phone: stringOrNull(data.phone),
    isBlocked: boolOrDefault(data.isBlocked, false),
    sellerVerified: boolOrDefault(data.sellerVerified, false),
    joinedAt: toIsoStringOrNull(data.joinedAt),
  };
}

export function toListingSummaryDto(id: string, data: DocumentData): PasumithraListingSummaryDto {
  return {
    id,
    title: stringOrNull(data.title),
    category: stringOrNull(data.category),
    breed: stringOrNull(data.breed),
    district: stringOrNull(data.district),
    price: numberOrNull(data.price),
    status: stringOrNull(data.status),
    sellerName: stringOrNull(data.sellerName),
    postedAt: toIsoStringOrNull(data.postedAt),
  };
}
