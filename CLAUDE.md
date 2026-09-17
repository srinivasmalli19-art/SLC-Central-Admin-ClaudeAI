# SLC Central Admin — Project Rules

This repo builds the **Central Admin control plane** for SLC Technologies' apps. Full
discovery/architecture docs live in [docs/](./docs/) — read those before making structural
decisions. This file is the condensed set of rules that discovery surfaced; keep it in sync if
those docs change.

## Non-negotiable rules

1. **Never modify an integrated app's production code, database, or deployment as a side
   effect of Central Admin work.** If an app genuinely needs a small additive change (e.g. an
   `isAdmin()` claim for JeevaMitra), that change is made in *that app's own repo*, reviewed and
   deployed by whoever owns it — not from inside this repo, and not implied by a Central Admin
   feature landing here.
2. **No shared database across apps, ever.** Each app keeps its own Firebase/Supabase project.
   The Central Admin has its own separate Postgres database for admin-platform concerns
   (admins, roles, audit logs, registry, settings, notifications) only.
3. **No app-specific credential is ever visible to the Central Admin frontend.** Every Firebase
   service-account JSON, Supabase service-role key, or other backend secret lives only in the
   Central Admin backend's environment/secrets store. Never commit one to git, never log one,
   never send one in an API response.
4. **New app integration = new adapter, not a platform rewrite.** Every integrated app gets one
   module under `/adapters/<slug>` implementing a subset of the common `AppAdapter` interface.
   Don't special-case app logic into the API routes, RBAC middleware, or frontend — those stay
   generic across apps.
5. **Least privilege by default.** Start every new adapter's credential as read-only; add write
   scope only when a specific, audited write capability is actually built.
6. **Every write that flows through an adapter is audit-logged**, before or immediately after
   it happens. This is a deliberate gap-fill versus every existing app, none of which have an
   audit log today.
7. **Don't over-engineer.** One Express backend, one Postgres database, no microservices, no
   message broker, no separate API gateway product — until there's a real, specific reason.

## Facts about the existing ecosystem (from discovery — verify before relying on stale facts)

- **SLC GPS Camera** (`gps_map_camera_pro`): Flutter, Android-only, **no backend, no auth, no
  admin entities at all**. Not an integration candidate. Has a real, pre-existing security issue
  (committed keystore credentials + hardcoded Maps API key) — unrelated to Central Admin, flag
  to the app owner separately.
- **JeevaMitra**: Flutter + Firebase (`jeevamitra` project), phone/OTP auth, Firestore-direct
  client access, only 2 Firestore-triggered Cloud Functions (no callable/HTTP API), **zero
  RBAC/admin infrastructure** — any write integration needs a new `isAdmin()` claim + rule added
  to that repo first.
- **Pasumithra** (`pasumithra-Web-application`): React/Vite web-app + Capacitor mobile shell +
  an already-built React `admin-portal`, all on one Firebase project (`pasumithra-adc10`), no
  Cloud Functions at all (fully client-SDK + rules). RBAC = `exists(/admins/{uid})` Firestore
  check, not custom claims. **Recommended first Central Admin integration target** — see
  [docs/INTEGRATION-STRATEGY.md](./docs/INTEGRATION-STRATEGY.md) for why. Known pre-existing
  issue: `admins` collection is publicly readable.
- **Pasumitra (original)**: single-commit legacy Flutter app, likely superseded by Pasumithra's
  Capacitor shell — confirm with the user before treating it as a live product.
- **NearSip**: Flutter + Supabase (project `slrhmbpokagxfushsdyj`), early/pre-production, not on
  the public site. Has a **real security issue**: its in-app admin login is a hardcoded
  client-side password check, not real auth — flag to the app owner independent of Central Admin.
  Defer integration until it's live.
- **Pasunestam**: Next.js + Firebase (`pasunestam-a753a`), server-only via `firebase-admin`,
  deny-all Firestore rules (best security posture in the ecosystem). Pre-admin-UI — no `/admin`
  section built yet, only Server Actions (no external API). Possibly the unreleased "SLC Vet"
  product referenced on the marketing site — **unconfirmed, ask the user**. Defer integration
  until it has either an admin section or `app/api/*` routes.
- **SLC Apps Portal**: the public marketing site (`slcvet.com`) — React/Vite, static/prerendered,
  no backend, independent codebase from every app it describes. Its `src/data/apps.js` is the
  canonical list of *publicly announced* apps/slugs, useful as registry seed data, nothing more.

## Where to look before assuming something is stale

- [docs/APPLICATION-INVENTORY.md](./docs/APPLICATION-INVENTORY.md) — per-app facts as of
  2026-09-17. Re-verify against the actual repo before relying on specifics (collection names,
  function names, etc.) if significant time has passed.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — the system design and why.
- [docs/INTEGRATION-STRATEGY.md](./docs/INTEGRATION-STRATEGY.md) — integration order and
  reasoning, credential-handling rules.
- [docs/ROADMAP.md](./docs/ROADMAP.md) — phased build plan with complexity estimates.
