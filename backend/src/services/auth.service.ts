import { localJwtAuthProvider } from "./auth/localJwtAuthProvider.js";
import type { AuthProvider } from "./auth/AuthProvider.js";

// The one line that would change to swap in Supabase Auth (or any other
// provider) later — see docs/PHASE-1-IMPLEMENTATION.md "Authentication design".
export const authProvider: AuthProvider = localJwtAuthProvider;

export const authService = {
  login: authProvider.login,
  verifyToken: authProvider.verifyToken,
};
