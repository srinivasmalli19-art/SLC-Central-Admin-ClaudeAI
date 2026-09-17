import { apiRequest } from "./client";
import type { Application } from "./types";

export type ApplicationInput = Partial<
  Pick<
    Application,
    | "name"
    | "slug"
    | "description"
    | "platform"
    | "environment"
    | "status"
    | "repositoryRef"
    | "frontendUrl"
    | "backendUrl"
    | "integrationType"
    | "enabled"
  >
>;

export const applicationsApi = {
  list() {
    return apiRequest<{ applications: Application[] }>("/applications");
  },
  create(input: ApplicationInput) {
    return apiRequest<{ application: Application }>("/applications", { method: "POST", body: input });
  },
  update(id: string, input: ApplicationInput) {
    return apiRequest<{ application: Application }>(`/applications/${id}`, { method: "PATCH", body: input });
  },
  remove(id: string) {
    return apiRequest<void>(`/applications/${id}`, { method: "DELETE" });
  },
};
