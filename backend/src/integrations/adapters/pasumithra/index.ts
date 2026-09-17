import { PasumithraAdapter } from "./pasumithraAdapter.js";

let instance: PasumithraAdapter | null = null;

export function getPasumithraAdapter(): PasumithraAdapter {
  if (!instance) {
    instance = new PasumithraAdapter();
  }
  return instance;
}

export { PasumithraAdapter, PasumithraUnavailableError } from "./pasumithraAdapter.js";
export type {
  PasumithraAdminDto,
  PasumithraDashboardSummaryDto,
  PasumithraListingSummaryDto,
  PasumithraUserSummaryDto,
} from "./dto.js";
