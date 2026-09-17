# Integration Strategy

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the overall design and
[APPLICATION-INVENTORY.md](./APPLICATION-INVENTORY.md) for the per-app facts this is based on.

## How a new app gets integrated, in general

1. Add a row to the `applications` registry table (name, slug, tech, status).
2. Create `/adapters/<slug>/` in the Central Admin backend implementing whichever subset of
   the `AppAdapter` interface that app supports.
3. Provision that app's own credentials (a Firebase service account scoped to its project, or
   a Supabase service-role key) as environment variables / secrets **for the Central Admin
   backend only** — this is an infra step in a cloud console, not a code change to the app
   itself.
4. If (and only if) a write capability needs a safety rail the app doesn't have yet (e.g. an
   `isAdmin()` Firestore rule), make that one small, additive change directly in that app's own
   repo — reviewed and deployed by whoever owns that app, on its own release cycle. Read-only
   integration never requires touching the app's code at all.
5. Wire the frontend's generic per-app admin view to whatever the adapter now exposes.

Nothing above requires rewriting an app's frontend, migrating its database, or changing how its
own end users experience it.

## First integration target: Pasumithra

**Recommendation: integrate Pasumithra (`pasumithra-Web-application`) first.**

### Why Pasumithra, specifically (architectural reasoning, not preference)

- **It already has a fully-built, documented admin surface.** The existing `admin-portal`
  covers Users, Listings, Master Data, Moderation, Notifications, and Reports — almost a 1:1
  match with what the Central Admin needs to expose for this app. There is no guessing about
  what "administering Pasumithra" means; it's already specified in working code.
- **It is architecturally the simplest to connect to.** Pasumithra has **no Cloud Functions
  layer** — everything is direct Firestore access gated by rules. That sounds like a limitation
  (see inventory), but for a *first* integration it's actually the easiest starting point: the
  Central Admin backend's adapter needs exactly one thing — a Firebase Admin SDK service
  account for project `pasumithra-adc10` — and can then read/write the same, already-documented
  Firestore collections the existing admin-portal uses. There's no separate API surface to
  design, reverse-engineer, or add first.
- **It's live, in production, with real users and real listings** — unlike NearSip and
  Pasunestam (early/pre-admin-UI) — so integrating it delivers real value immediately rather
  than being a proof of concept against a low-stakes app.
- **The app's own documentation names the exact gaps a Central Admin fills.** Pasumithra's
  `KNOWN_LIMITATIONS.md` and `VERSION2_BACKLOG.md` explicitly list: no audit log of admin
  actions, no admin-account-provisioning workflow, no real Firebase Auth account deletion, no
  FCM push delivery. A Central Admin with real backend (Admin SDK) access is well positioned to
  add exactly these, meaning this integration adds new capability rather than duplicating the
  existing admin-portal.
- **Zero changes to Pasumithra's production code are required to start.** Granting a new
  Firebase service account read access to an existing Firestore project is an IAM/console
  action, not a deploy. The existing `admin-portal` keeps working, unmodified, side by side with
  Central Admin, for as long as needed during transition.

### What Pasumithra's adapter should do, in order

1. **Read-only first**: `getHealth()` (a cheap Firestore read), `listUsers()`, `listEntities('listings')`,
   `getAnalyticsSummary()` — mirrors what `admin-portal`'s Dashboard/Reports pages already show,
   proving the adapter pattern works against real data with zero risk.
2. **Moderation actions next**: `updateUserStatus()` (block/unblock), listing status changes —
   every one of these now gets an audit-log entry, which is new.
3. **New capability last**: admin-account provisioning via the Central Admin (instead of manual
   Firebase Console edits to the `admins` collection) and a real audit trail for master-data
   edits — the two things `VERSION2_BACKLOG.md` says this app wants but has no backend to build
   them with.

Independent of the Central Admin, flag to whoever owns this repo: the `admins` collection is
publicly readable — worth tightening to `isAdmin()`-gated reads regardless of this integration.

### Second integration candidate

**JeevaMitra** is the natural second target: also live/production, but requires more upfront
work than Pasumithra because it has *no* existing RBAC/admin infrastructure at all (see
inventory) — a Central Admin can start read-only against its Firestore project immediately, but
any write capability needs a new `isAdmin()` claim + rule added to JeevaMitra's own repo first.
This is exactly the kind of small, additive, app-owner-reviewed change described in step 4 above.

### Deferred: NearSip and Pasunestam

Both are pre-production or pre-admin-UI (see inventory) — integrating them now would mean
building admin infrastructure for apps that don't have real users yet. Revisit once either app
ships publicly. NearSip in particular has an existing *security* problem (hardcoded admin
password) that should be fixed by its own team regardless of whether/when Central Admin
integrates with it.

### Excluded: SLC GPS Camera, Pasumitra (original)

SLC GPS Camera has no backend, no data, no admin entities — there is nothing to integrate.
Pasumitra (original) appears superseded by Pasumithra's Capacitor-wrapped mobile build; confirm
with the user before spending any integration effort there.

## Credential handling rules (non-negotiable)

- Every service-account JSON / service-role key lives only in the Central Admin backend's
  environment variables or a secrets manager (e.g. the hosting provider's built-in secrets,
  or a dedicated vault) — never in a repo, never in a frontend bundle, never in a log line.
- The Central Admin frontend authenticates only against the Central Admin's own Supabase-Auth
  JWT — it never receives, stores, or proxies any integrated app's credentials.
- Each adapter should use the **least-privilege** credential possible for what it actually
  does (e.g. a Firestore service account with read-only IAM to start, upgraded only when a
  write capability is actually built and audited).
