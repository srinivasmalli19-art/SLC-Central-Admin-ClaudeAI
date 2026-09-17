import { apiRequest } from "./client";
import type { AuthUser, LoginResponse } from "./types";

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<LoginResponse>("/auth/login", { method: "POST", body: { email, password } });
  },
  logout() {
    return apiRequest<void>("/auth/logout", { method: "POST" });
  },
  me() {
    return apiRequest<{ user: AuthUser }>("/auth/me");
  },
};
