// Abstraction over "how a Central Admin staff member proves who they are."
//
// Phase 1 ships `localJwtAuthProvider` (bcrypt + self-issued JWT, backed by
// the Central Admin's own Postgres `admin_users` table) because it needs to
// run and be tested end-to-end without any external account. ARCHITECTURE.md
// originally proposed Supabase Auth for this — that remains a valid future
// swap (e.g. once a dedicated Supabase project is provisioned) and should
// only require a new class implementing this same interface, wired in
// `auth.service.ts`. Nothing else in the codebase (routes, controllers, RBAC
// middleware, frontend) should need to change to make that swap.
export interface AuthenticatedPrincipal {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: AuthenticatedPrincipal;
}

export interface AuthProvider {
  login(email: string, password: string): Promise<LoginResult>;
  verifyToken(token: string): Promise<AuthenticatedPrincipal>;
}
