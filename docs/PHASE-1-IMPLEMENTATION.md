# Phase 1 — Central Admin Foundation: Implementation Record

Status: **complete**, build-validated. This document explains exactly what was built, why, and
how to run it. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the target design this implements
and [ROADMAP.md](./ROADMAP.md) for what comes next.

## Architectural conflict flagged and resolved before implementation

ARCHITECTURE.md originally proposed **Supabase Auth** for Central Admin staff login. Building
against that in Phase 1 would have required a live external Supabase project and real API keys
— something this session cannot provision, and something Phase 1's own rules forbid adding
("do not add production credentials"). This was raised explicitly before writing any code; the
user chose:

**Self-hosted email/password authentication** — bcrypt password hashing + a self-issued JWT,
backed entirely by the Central Admin's own Postgres `admin_users` table. It is built behind a
small `AuthProvider` interface (`backend/src/services/auth/AuthProvider.ts`) specifically so that
Supabase Auth (or any other provider) can be swapped in later by adding one new class and
changing one line in `backend/src/services/auth.service.ts` — no route, controller, RBAC
middleware, or frontend code should need to change to make that swap.

A second, smaller implementation decision: no Docker/local Postgres/`psql` existed in the build
environment. `postgresql@16` was installed locally via Homebrew (a reversible, local-only dev
tool install) so migrations and tests could run against a real Postgres instance, exactly
matching ARCHITECTURE.md's database choice — no compromise was needed here.

## A. What was built

- **Backend**: `backend/` — Node.js + Express + TypeScript REST API.
- **Frontend**: `frontend/` — React + Vite + TypeScript + Tailwind SPA.
- **Database**: a dedicated local PostgreSQL 16 instance (`slc_central_admin_dev` for
  development, `slc_central_admin_test` for automated tests), managed via Prisma migrations.
- **Auth**: self-hosted JWT + bcrypt (see above), with the `AuthProvider` swap point.
- **RBAC foundation**: `SUPER_ADMIN` (implicit full access) and `ADMIN` (permission-scoped)
  roles, a `Permission` catalogue, and `RolePermission` grants — extensible without rewriting
  authorization logic (adding a permission = one catalogue entry + a grant row, never a code
  change to `rbac.middleware.ts`).
- **Application registry**: full CRUD (`Application` model + `/api/applications`), seeded from
  nothing — no application is pre-registered, since seeding fake registry rows would risk being
  mistaken for a real integration.
- **Audit log foundation**: every login, failed login, admin-user change, and application
  registry change is recorded, with a defensive sanitizer that strips any password/token/secret-
  shaped field before it's ever written.
- **Health endpoint**: `/api/health` — reports on the Central Admin platform itself (its own
  database connectivity) only. It does **not** report on any integrated application, because no
  adapter exists yet to actually check one — see docs/ROADMAP.md Phase 4+.
- **Integration adapter scaffolding**: `backend/src/integrations/adapters/AppAdapter.ts` defines
  the common interface future adapters will implement. No concrete adapter exists — Pasumithra,
  JeevaMitra, etc. are **not** integrated in Phase 1, per your explicit instructions.
- **Dashboard**: aggregates only Central-Admin-owned data (application counts by status, admin
  user count, recent audit activity) plus an explicit "not monitored" health placeholder — it
  never fabricates a health status for an application with no real check.

## B. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Backend runtime | Node.js + Express + TypeScript | Matches ARCHITECTURE.md; ecosystem is already Node-based (every existing Cloud Functions codebase is Node) |
| ORM / migrations | Prisma | Type-safe queries + a real migration history against Postgres, without hand-written SQL |
| Database | PostgreSQL 16 (local, via Homebrew) | Matches ARCHITECTURE.md's reasoning (relational RBAC/audit data); the Central Admin's own DB is never shared with any integrated app |
| Auth | Self-hosted JWT + bcrypt, behind an `AuthProvider` interface | See "Architectural conflict" above — Supabase Auth remains the documented future option |
| Frontend | React 18 + Vite 5 + TypeScript + Tailwind CSS + React Router 6 | Mirrors Pasumithra's existing `admin-portal` stack — the closest real precedent in the ecosystem (docs/APPLICATION-INVENTORY.md) |
| Backend tests | Vitest + Supertest, against a real local Postgres test database | Integration-level confidence (real SQL, real Prisma queries) rather than mocking the database |
| Validation | Zod (backend) | Already used elsewhere in the ecosystem (`pasunestam`); consistent, typed request validation |
| Logging | Pino + pino-http | Structured JSON logs in production, readable pretty-printed logs in development |

Monorepo note: a root `package.json` with npm workspaces (`backend`, `frontend`) was added purely
for convenience (`npm install`/`npm run build`/`npm test` once from the repo root) — this is not
a build tool or abstraction layer, just npm's built-in workspace feature.

## C. Database schema

All tables live in the Central Admin's own database only — **no integrated application's
business data is stored here**, by design (see ARCHITECTURE.md "no shared database across
apps"). Full definitions: `backend/prisma/schema.prisma`.

- `admin_users` — Central Admin staff accounts (email, bcrypt password hash, name, role,
  active flag, last login). Never mixed with any integrated app's own end-user table.
- `roles` — `SUPER_ADMIN` and `ADMIN` (seeded), marked `isSystem` to protect them from deletion.
  More roles can be added later as plain rows.
- `permissions` — the fixed permission catalogue (`admin_users:manage`, `roles:manage`,
  `applications:read`, `applications:manage`, `audit_logs:read`, `dashboard:read`).
- `role_permissions` — join table granting permissions to roles. `SUPER_ADMIN` intentionally has
  no rows here — it's granted implicit full access in code, so a newly added permission is never
  accidentally missing from Super Admin's grants.
- `applications` — the application registry (name, slug, description, platform, environment,
  status, repository reference, frontend/backend URLs, integration type, enabled flag).
- `health_checks` — foundation for future adapter health data (Phase 4+). No rows are written in
  Phase 1 for any registered application.
- `audit_logs` — actor, action, target type/id, sanitized metadata, IP, timestamp.

Migration history: `backend/prisma/migrations/20260917082838_init/`.

## D. Authentication design

1. An admin logs in with email + password (`POST /api/auth/login`).
2. The backend looks up the account by email, verifies the bcrypt hash, and — on success —
   issues a JWT (`{ sub, email, role }`, signed with `JWT_SECRET`, expiring per `JWT_EXPIRES_IN`).
   The same generic "Invalid email or password" error is returned whether the email doesn't
   exist or the password is wrong, so login can't be used to enumerate admin accounts.
3. The frontend stores the token in `localStorage` and sends it as `Authorization: Bearer <token>`
   on every subsequent request.
4. `requireAuth` middleware verifies the token and loads the current admin user (rejecting
   deactivated accounts) on every protected route.
5. Logout (`POST /api/auth/logout`) records an audit entry; since JWTs are stateless in Phase 1,
   there is no server-side session to revoke — the client discards the token. Real revocation
   (a token blocklist, or short-lived tokens + refresh) is a Phase 8 hardening candidate if
   needed.

This identity system is **completely independent** of every integrated application's own
end-user auth (JeevaMitra's phone/OTP, Pasumithra's phone/OTP + email/password, NearSip's Supabase
Auth) — no merging was attempted, per your explicit instruction.

## E. RBAC design

- `SUPER_ADMIN`: implicit access to every permission (checked first, short-circuits the
  permission lookup in `rbac.service.ts`) — manages other admin accounts, roles, and the
  application registry.
- `ADMIN`: scoped to whatever permissions are explicitly granted via `role_permissions`. Seeded
  by default with `applications:read`, `audit_logs:read`, `dashboard:read` — i.e. an ADMIN can
  see the registry, audit trail, and dashboard, but cannot create/edit applications or manage
  other admin accounts unless granted `applications:manage` / `admin_users:manage`.
- Enforcement: `requireAuth` then `requirePermission(<key>)` middleware on every protected route.
  Adding a new permission never requires touching this middleware — only the catalogue and the
  relevant route's `requirePermission()` call.
- Per-application permission scoping (an `admin_user_apps` table letting an ADMIN be scoped to
  *specific* applications rather than all of them) was deliberately **not** built in Phase 1 —
  it's meaningless before any real adapter exists to scope access to. Flagged for Phase 4, when
  the first adapter (Pasumithra) is built.

## F. API endpoints

All under `/api`. `🔒` = requires a valid JWT. `🔒+perm` = also requires the named permission.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Central Admin platform health (DB connectivity) only |
| POST | `/auth/login` | none | Sign in, returns `{ token, user }` |
| POST | `/auth/logout` | 🔒 | Audit-logs the sign-out (stateless JWT, no server revocation) |
| GET | `/auth/me` | 🔒 | Current authenticated admin user |
| GET | `/admin-users` | 🔒+`admin_users:manage` | List Central Admin staff accounts |
| POST | `/admin-users` | 🔒+`admin_users:manage` | Create a staff account |
| PATCH | `/admin-users/:id/role` | 🔒+`admin_users:manage` | Change a staff account's role |
| PATCH | `/admin-users/:id/active` | 🔒+`admin_users:manage` | Activate/deactivate a staff account |
| GET | `/applications` | 🔒+`applications:read` | List the application registry |
| GET | `/applications/:id` | 🔒+`applications:read` | Get one registry entry |
| POST | `/applications` | 🔒+`applications:manage` | Create a registry entry |
| PATCH | `/applications/:id` | 🔒+`applications:manage` | Update a registry entry |
| DELETE | `/applications/:id` | 🔒+`applications:manage` | Remove a registry entry |
| GET | `/audit-logs` | 🔒+`audit_logs:read` | Recent audit log entries (`?limit=`) |
| GET | `/dashboard` | 🔒+`dashboard:read` | Aggregated dashboard summary |

## G. Security measures

- Passwords hashed with bcrypt (cost factor 12); never logged, never returned in any API
  response (`adminUsers.service.ts` strips `passwordHash` before returning a user object).
- JWT secret and all other config loaded from environment variables only, validated at startup
  by a Zod schema (`config/env.ts`) — the process refuses to start with a missing/weak
  `JWT_SECRET`.
- `helmet` for standard security headers; CORS locked to a configured origin (`CORS_ORIGIN`),
  not wide open.
- Audit log metadata is passed through a defensive denylist filter
  (`FORBIDDEN_METADATA_KEYS` in `auditLog.service.ts`) that strips any field whose name looks
  like a password/token/secret/API key — a backstop even though no current caller passes one.
- `.env`, `.env.local`, and every build output directory are excluded via `.gitignore`; only
  `.env.example` files (placeholder values) are committed.
- No integrated application's credentials exist anywhere in this codebase — the
  `integrations/adapters/` folder contains only an interface definition, no implementation, no
  secrets.
- Generic, non-enumerating error messages on login failure (see Authentication design above).

## H. Tests performed

Backend (`backend/tests/`, 26 tests, all passing), run against a real local Postgres test
database (not mocked):

- **Authentication** (`auth.test.ts`): successful login; unknown email; wrong password;
  deactivated account rejected; malformed payload rejected; `/auth/me` returns the current user.
- **Protected routes** (`auth.test.ts`): missing Authorization header, malformed header, and
  garbage token all rejected with 401.
- **RBAC** (`rbac.test.ts`): `SUPER_ADMIN` has implicit access; `ADMIN` is correctly allowed for
  its granted permissions and correctly forbidden (403) for permissions it lacks.
- **Application CRUD** (`applications.test.ts`): create (with slug derivation), duplicate-slug
  conflict (409), list, get-by-id (and 404 for unknown id), update, delete.
- **Audit logging** (`auditLog.test.ts`): `LOGIN` and `LOGIN_FAILED` entries are recorded
  (without leaking the attempted password); `APPLICATION_CREATED` entries capture the actor;
  the metadata sanitizer strips password/apiKey-shaped fields even when a caller tries to pass
  them.
- **Health endpoint** (`health.test.ts`): reports `ok` with a live database connection.

Frontend: no automated component tests were added in Phase 1 (the priority was the backend's
security-critical logic); the frontend was instead validated via a full build + a live dev-server
smoke check. This is a reasonable gap to close in a later phase if the UI grows more logic.

## I. Build validation result

All run from the repo root against a clean `npm install` (after deleting all `node_modules`):

| Step | Result |
|---|---|
| `npm install` (root, npm workspaces) | ✅ succeeds |
| `npx prisma generate` | ✅ succeeds |
| `npx prisma migrate dev` (dev DB) | ✅ succeeds — initial migration applied |
| `npm run db:seed` | ✅ succeeds — roles/permissions seeded, bootstrap Super Admin created |
| `npm test` (backend, 26 tests) | ✅ all passing |
| `npm run lint` (backend + frontend) | ✅ 0 errors (1 harmless frontend warning — see below) |
| `npm run build` (backend `tsc` + frontend `tsc -b && vite build`) | ✅ both succeed |
| Backend server start (`node dist/server.js`) | ✅ starts; `/health`, `/auth/login`, `/auth/me`, `/dashboard` all verified live via curl |
| Frontend dev server (`npm run dev`) | ✅ starts, serves the SPA shell on port 5173 |

The one lint warning: `frontend/src/context/AuthContext.tsx` — a React Fast Refresh lint rule
noting the file exports both a component and a hook. Harmless (does not affect production
behavior), extremely common for context files, and not worth splitting into two files for
Phase 1.

## J. Remaining Phase 1 issues / deliberately deferred items

- **No frontend automated tests** (see Tests section above) — acceptable for Phase 1, worth
  revisiting once the UI has more business logic.
- **`admin_user_apps` (per-application RBAC scoping)** was not built — deferred to Phase 4, since
  it's meaningless without a real adapter to scope access to.
- **JWTs cannot be server-side revoked** before they expire (stateless by design) — acceptable
  for Phase 1's internal, low-admin-count usage; revisit in Phase 8 (Production Hardening) if a
  real need appears (e.g. immediately revoking a compromised admin's access).
- **No rate limiting on `/auth/login`** yet — flagged for Phase 8 alongside MFA and secrets
  rotation, per ROADMAP.md.
- **PostgreSQL was installed locally via Homebrew** for this build environment. Production
  deployment should point `DATABASE_URL` at a real managed Postgres instance (see "Production
  deployment considerations" below) — nothing in the code assumes a local database.
- Two npm `audit` vulnerability warnings appeared during install (mostly from transitive
  dev-tooling dependencies — eslint 8's dependency tree, etc.); not investigated in depth for
  Phase 1 since none are in runtime-facing packages, but worth a look before Phase 8.

## K. Recommended next step

Proceed to **Phase 2 as originally scoped in ROADMAP.md is already substantially covered** by
this Phase 1 build (the user's Phase 1 request combined Foundation + Auth/RBAC + Registry into
one phase). The next real step is **Phase 4 — First Application Integration: Pasumithra**
(ROADMAP.md), starting with a read-only adapter (`getHealth`, `listUsers`, `listEntities`,
`getAnalyticsSummary`) using a least-privilege Firebase service account for the
`pasumithra-adc10` project — per INTEGRATION-STRATEGY.md, this requires no changes to
Pasumithra's own repository to begin.

---

## Setup instructions

### Prerequisites

- Node.js 20+ (built and tested with Node 26)
- PostgreSQL 16 running locally (or reachable via `DATABASE_URL`)
  - macOS: `brew install postgresql@16 && brew services start postgresql@16`
- Two local databases: one for development, one for tests
  ```bash
  createdb slc_central_admin_dev
  createdb slc_central_admin_test
  ```

### Environment variables

Copy each `.env.example` to `.env` and fill in real local values — **never commit a real `.env`**:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend (`backend/.env`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string for the Central Admin's own database |
| `JWT_SECRET` | Long random secret for signing session JWTs — generate with `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | Session lifetime (default `8h`) |
| `PORT` | Backend port (default `4000`) |
| `CORS_ORIGIN` | Allowed frontend origin (default `http://localhost:5173`) |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` / `SEED_SUPER_ADMIN_NAME` | Used once by `prisma/seed.ts` to create the first Super Admin — set these before seeding, then treat the password as sensitive |
| `LOG_LEVEL` | Pino log level (default `info`) |

Frontend (`frontend/.env`):

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API (default `http://localhost:4000/api`) |

### Database setup

```bash
cd backend
npx prisma migrate dev   # applies migrations to DATABASE_URL
npm run db:seed          # seeds roles/permissions + the first Super Admin
```

### Authentication setup

No external account or service is required in Phase 1 — the first Super Admin is created
directly by the seed script from `SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD`. Sign in
at the frontend's `/login` page with those credentials. Additional admin accounts are created
from the "Admin Users" page (Super Admin only).

### Development commands

From the repo root (npm workspaces):

```bash
npm install              # installs both backend and frontend dependencies
npm run dev:backend       # starts the backend on :4000 (tsx watch)
npm run dev:frontend      # starts the frontend on :5173 (vite)
npm test                  # runs the backend test suite (migrates the test DB first)
npm run lint              # lints both workspaces
npm run build             # builds both workspaces
```

### Production deployment considerations

- **Backend**: deploy as a standard Node process (Render/Fly.io/a VM/Cloud Run) — not a
  serverless function platform, given the persistent DB connection pool and the scheduler work
  planned for Phase 7. Run `npx prisma migrate deploy` (not `migrate dev`) as part of the deploy
  step. Set a strong, unique `JWT_SECRET` and a real `DATABASE_URL` pointing at a managed
  Postgres instance — never reuse the local dev secret generated during this build.
- **Frontend**: any static host (the ecosystem already has Cloudflare Pages / Firebase Hosting
  experience — either works fine for a Vite SPA build). Set `VITE_API_BASE_URL` to the deployed
  backend's URL at build time.
- **Secrets**: use the hosting platform's secrets manager (not a committed `.env`) for
  `JWT_SECRET`, `DATABASE_URL`, and — once Phase 4+ adapters exist — every integrated
  application's service-account/service-role credentials.
- **CORS**: set `CORS_ORIGIN` to the real frontend origin, not `http://localhost:5173`.
- Bootstrap the production Super Admin the same way as dev (`SEED_SUPER_ADMIN_*` env vars +
  `npm run db:seed`, run once against production), then remove/rotate that seed password.
