# Implementation Roadmap

Phased so every phase ships something usable and reversible. Complexity is relative
(S/M/L/XL), not calendar time — actual duration depends on the user's availability.

## Phase 0 — Discovery ✅ (this document set)
Repository/architecture discovery across all locally-available SLC repos; no code changes to
any existing app. Output: `APPLICATION-INVENTORY.md`, `ARCHITECTURE.md`, `INTEGRATION-STRATEGY.md`,
this roadmap, and `CLAUDE.md`.
**Complexity: done.**

## Phase 1 — Central Admin Foundation
- Scaffold the Central Admin backend (Node/Express/TypeScript) and frontend (React/Vite/TS/Tailwind).
- Provision the Central Admin's own Postgres database (e.g. a dedicated Supabase project used
  purely as managed Postgres — not shared with NearSip's project).
- Basic health-check endpoint, empty dashboard shell, CI (lint/build) for the new repo.
- No integration with any existing app yet.
**Complexity: S.** Mostly scaffolding; low risk since nothing external is touched.

## Phase 2 — Authentication / RBAC
- Wire Supabase Auth for Central Admin staff login (email/password to start).
- Build `admin_users`, `roles`, `permissions`, `role_permissions`, `admin_user_apps` tables.
- Implement Super Admin vs. Admin distinction; middleware that checks JWT + permissions on
  every backend route.
- First Super Admin account created via a one-time bootstrap script/seed (mirrors the pattern
  Pasumithra's own admin-portal already uses for its first admin — proven to work).
**Complexity: M.** Standard but must be done carefully — this gates every later phase's security.

## Phase 3 — Application Registry
- `applications` and `health_checks` tables; CRUD UI for Super Admins to view/edit registry
  entries (seeded initially from `APPLICATION-INVENTORY.md`).
- Registry-only for now — no live adapters wired in, just the metadata + manual status field.
- Basic audit_logs table and middleware that records every write made through the Central
  Admin API from this point forward.
**Complexity: S–M.**

## Phase 4 — First Application Integration: Pasumithra
- Provision a Firebase Admin SDK service account for `pasumithra-adc10` (read-only IAM to
  start), stored only in the Central Admin backend's secrets.
- Build the Pasumithra adapter: `getHealth()`, `listUsers()`, `listEntities('listings')`,
  `getAnalyticsSummary()` — read-only.
- Frontend: a generic per-app admin view rendering whatever the adapter exposes; wire it to
  Pasumithra's registry entry.
- Once read-only is solid and audited for a while, add write capability (block/unblock user,
  listing moderation actions) — every write now produces an audit log entry, which is new
  capability versus the existing admin-portal.
- No changes to `pasumithra-Web-application`'s own code required for the read-only slice;
  the write slice is also possible with zero app changes since it reuses the exact
  `admins/{uid}`-gated Firestore access pattern the existing admin-portal already relies on,
  just from server-side Admin SDK credentials instead of the client SDK.
**Complexity: M.** The adapter pattern is proven here; most of the effort is deliberately
front-loaded so Phase 5 is faster.

## Phase 5 — Second Application Integration: JeevaMitra
- Provision a Firebase Admin SDK service account for `jeevamitra` (read-only).
- Build the JeevaMitra adapter: read-only listing of users, bookings, disease alerts.
- **Before any write capability**: add a small, additive `isAdmin()` custom claim + Firestore
  rule to JeevaMitra's own repo (reviewed/deployed by whoever owns that codebase) — this app
  currently has zero admin/RBAC infrastructure, unlike Pasumithra.
- Resolve the ambiguous two-router-tree / two-auth-screen-set situation noted in the inventory
  with JeevaMitra's maintainer before building UI that depends on one of them, if that hasn't
  already been resolved independently.
**Complexity: M–L.** Harder than Phase 4 specifically because the safety rails (claims, rules)
don't exist yet and must be added carefully to a live app.

## Phase 6 — Additional Applications
- NearSip: integrate once it's confirmed live/public; independently, flag to its owner that the
  hardcoded admin password check needs replacing with real Supabase Auth + role column first.
- Pasunestam: integrate once it has either a real `/admin` section or a thin `app/api/*` layer
  wrapping its existing Server Actions; clarify with the user whether this is the "SLC Vet"
  product referenced on the marketing site.
- SLC GPS Camera: registry-only entry (no backend to integrate); revisit only if this app ever
  grows a backend.
- Optional: build the adapter-capability-gated "enable/disable" maintenance-mode flag for apps
  that can support it (Pasumithra first, since it already has a `config` collection).
**Complexity: M per app**, since the adapter pattern and RBAC/audit plumbing are already built
by this point — each new app is mostly "write one adapter."

## Phase 7 — Monitoring / Analytics
- Scheduled health-check polling across all integrated adapters, dashboard surfacing status
  history (not just current state).
- Cross-app analytics dashboard aggregating each adapter's `getAnalyticsSummary()`.
- Notification bell for health-check failures and aggregated moderation queues.
**Complexity: M.**

## Phase 8 — Production Hardening
- MFA for Super Admin accounts.
- Secrets rotation process for every adapter's service account/service-role key.
- Rate limiting / IP allowlisting for the Central Admin login, given a single compromised
  account now has reach across every integrated app.
- Backup/restore plan for the Central Admin's own Postgres database.
- Independent security review of the whole Central Admin backend (not just this discovery pass).
- Address the pre-existing issues flagged during discovery that sit outside Central Admin's
  scope but affect the ecosystem's overall security posture: Pasumithra's publicly-readable
  `admins` collection, SLC GPS Camera's committed keystore credentials, NearSip's hardcoded
  admin password.
**Complexity: M–L.**

## Explicitly out of scope for this roadmap

- Rewriting any existing app's frontend or backend.
- Migrating any app's database into a shared store.
- Building a Play Store publishing pipeline for SLC GPS Camera (unrelated to Central Admin).
- Introducing microservices, a message broker, or an API gateway product — the single Express
  backend is the gateway for as long as the current scale holds.
