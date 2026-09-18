import { JeevaMitraAdapter } from "./jeevamitraAdapter.js";

let instance: JeevaMitraAdapter | null = null;

export function getJeevaMitraAdapter(): JeevaMitraAdapter {
  if (!instance) {
    instance = new JeevaMitraAdapter();
  }
  return instance;
}

export { JeevaMitraAdapter, JeevaMitraUnavailableError } from "./jeevamitraAdapter.js";
export type { JeevaMitraDashboardSummaryDto, JeevaMitraDiseaseAlertDto, JeevaMitraUserSummaryDto } from "./dto.js";
