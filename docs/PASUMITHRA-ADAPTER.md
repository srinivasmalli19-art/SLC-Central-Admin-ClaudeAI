# Pasumithra Adapter — Integration Design & Record

Status: **read-only, implemented (Phase 4)**. This document is the integration map required
before writing code, plus the record of what was actually built. Source inspected directly:
`~/Repos/pasumithra-Web-application` (`firestore.rules`, `firestore.indexes.json`, `.firebaserc`,
`admin-portal/src/services/admin.js`, `admin-portal/src/context/AdminAuthContext.jsx`,
`admin-portal/src/pages/{SetupPage,UsersPage,ListingsPage}.jsx`, `admin-portal/src/firebase.js`).
No collection name or field name below is guessed — every one is quoted from that source.

## 1. Firebase project

- Project ID: **`pasumithra-adc10`** (`.firebaserc` → `projects.production`).
- Two Hosting targets on the *same* project (`web`, `admin`) — one Firebase project, one
  Firestore database, shared by the consumer web-app and the admin-portal.
- No Cloud Functions, no Firebase Admin SDK usage anywhere in the repo (confirmed via
  repo-wide `grep -rl "firebase-admin"` → zero matches) — the Central Admin's adapter is the
  **first** Admin SDK client this Firebase project will ever see.

## 2 & 3. Firestore collections and exact document structure actually used

Quoted from `admin-portal/src/services/admin.js`, `firestore.rules`, and the page components.

| Collection | Fields actually read/written by the admin-portal | Notes |
|---|---|---|
| `users/{userId}` | `name`, `phone`, `joinedAt` (Timestamp), `isBlocked` (bool), `sellerVerified` (bool), `sellerVerifiedAt` (Timestamp\|null) | Doc id = Firebase Auth uid. `deleteUser()` is actually a soft-block (`isBlocked: true`) — there is no hard user delete. |
| `listings/{listingId}` | `title`, `category`, `breed`, `district`, `price`, `status` (`active`\|`pending`\|`rejected`\|`suspended`\|`sold`), `postedAt` (Timestamp), `sellerId`, `sellerName`, `sellerPhone`, `imageUrls[]`, `isSold` (bool), `views`/`favoritesCount`/`sharesCount` | Public read; owner or admin write. |
| `listings/{listingId}/healthRecords/{recordId}` | `sellerId` (denormalized), `recordType` (`vaccination`\|`deworming`\|`pregnancy_check`\|…), `date`, `nextDueDate` | Read via `collectionGroup(db, 'healthRecords')` — requires the separate `{path=**}/healthRecords` rule (see §5). |
| `admins/{adminId}` | `email`, `name`, `role` (e.g. `superadmin`), `createdAt` (Timestamp) | Doc id = Firebase Auth uid. Created once by `SetupPage.jsx` for the first admin; every subsequent admin is added manually in the Firebase Console (no in-app "add admin" flow — deliberate, to prevent self-escalation). |
| `conversations/{convId}` | `participants[]` | Only used for a `getCountFromServer` total in the dashboard — no message content is read by the adapter. |
| `reports/{reportId}` | `status` (`OPEN`\|…), `createdAt`, `reportedBy` | Moderation queue — read-only count/list, no write in Phase 4. |
| `config/{docId}`, `referenceData/{itemId}`, `animalTypes/{typeId}`, `breeds/{breedId}`, `diseases/{diseaseId}`, `vaccines/{vaccineId}`, `notifications/{notifId}`, `favorites/{userId}`, `searchMeta/{docId}` | Not accessed by this adapter | Out of scope for Phase 4 — no admin-portal page in the discovered code needed them for the dashboard/users/listings/admins views this phase covers. Can be added as new adapter methods later without touching the adapter's existing methods. |

## 4. Existing admin operations (from `admin.js`, for context — none of these are re-implemented as writes here)

`setUserBlocked`, `setSellerVerified`, `deleteUser` (soft-block), `setListingStatus`,
`adminDeleteListing`, `sendBroadcastNotification`, `setReportStatus` — all client-SDK writes
gated by `isAdmin()` in `firestore.rules`. **None of these are implemented by the Central Admin
adapter.** Phase 4 is read-only per your explicit instruction; if/when write capability is
approved for a later phase, these are the exact operations to mirror (with an audit-logged
Central Admin route in front of each, per `docs/INTEGRATION-STRATEGY.md`).

## 5. Existing Firebase security rules (verbatim structure, not paraphrased)

- `isAdmin()` = `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` — a
  Firestore document check, not a custom Auth claim.
- `admins/{adminId}`: **`allow read: if true`** — publicly readable by design, so `SetupPage`
  can count existing admins before any admin exists. **This is the issue flagged in
  `docs/APPLICATION-INVENTORY.md`.** See §9 below for how this adapter avoids relying on it.
- `users/{userId}`: read requires sign-in; write is owner-allowlisted-fields-or-admin.
- `listings/{listingId}`: public read; write is owner-or-admin, plus a narrow public
  metric-bump carve-out.
- A **separate** `{path=**}/healthRecords` collection-group rule exists specifically because
  Firestore does not consult the nested `/listings/{id}/healthRecords` rule for
  `collectionGroup()` queries — both the web app and the admin dashboard rely on this second
  rule. (Irrelevant to the Admin SDK, which bypasses all rules — noted here only because it's
  real, documented behavior in the source, not a guess.)
- `reports/{reportId}`: create by any signed-in user; read/update/delete admin-only.

## 6. Existing admin (staff) collection structure

`admins/{uid}` — flat document, fields `email`, `name`, `role`, `createdAt`. No sub-roles beyond
the single string `role` field (`SetupPage.jsx` hardcodes `role: 'superadmin'` for the bootstrap
admin; nothing in the discovered code creates any other role value). No custom Firebase Auth
claims are used anywhere — admin-ness is purely "a document exists at this uid."

## 7. Existing user-related collections

`users/{uid}` (see §2/§3) is the only end-user collection this adapter touches. `favorites/{uid}`
and `conversations/{convId}` also relate to users but are out of scope for Phase 4 (see §3 table).

## 8. Existing application configuration collections

`config/{docId}` (e.g. categories) and `referenceData/{itemId}`/`animalTypes`/`breeds`/
`diseases`/`vaccines` exist but are **not read by this adapter** — no admin-portal page in scope
for Phase 4 (Dashboard, Users, Listings, Admins) needed them.

## 9. Security risk: the publicly-readable `admins` collection

Per `docs/APPLICATION-INVENTORY.md`, `admins` is `allow read: if true` in Pasumithra's own
`firestore.rules`. This is a **pre-existing issue in Pasumithra**, not something introduced by or
fixable from the Central Admin:

- **Not silently modified.** This adapter does not touch, deploy, or suggest a change to
  Pasumithra's `firestore.rules`. Fixing it is Pasumithra's own team's call, on Pasumithra's own
  release cycle, exactly per `CLAUDE.md` rule 1.
- **Not relied upon for Central Admin authorization.** The Central Admin never checks "does an
  `admins/{uid}` doc exist" to decide whether a *Central Admin* user is authorized — Central
  Admin authorization is entirely its own JWT + RBAC system (`requireAuth` + `pasumithra:read`
  permission, see §12), completely independent of Pasumithra's `admins` collection.
- **Reads use the Admin SDK, which bypasses security rules entirely** — so this adapter's
  `listAdmins()` read is no more (and no less) exposed than the status quo: the same data is
  already fetchable by anyone with an unauthenticated client SDK call, today, in production. The
  adapter does not create a new exposure; it centralizes an existing one behind Central Admin's
  own auth+RBAC+audit-log, which is strictly more controlled than the current public-read state.

## 10. Existing Firebase Admin SDK usage

**None.** Confirmed via repo-wide search. This Central Admin adapter is the first Admin SDK
client ever introduced against this Firebase project — there is no existing pattern to reuse or
conflict with inside Pasumithra's own codebase.

---

## Adapter architecture

```
backend/src/integrations/adapters/pasumithra/
  config.ts          — loads/validates PASUMITHRA_FIREBASE_* env vars (non-throwing; returns a
                        result type so a missing/bad config becomes a "configuration_error"
                        health status, not a crashed server)
  firebaseClient.ts   — lazily initializes a *named* firebase-admin App ("pasumithra"), isolated
                        from any other adapter's App instance; supports pointing at the Firestore
                        emulator for tests via FIRESTORE_EMULATOR_HOST
  errorClassification.ts — maps a raw Firestore/Firebase error into one of
                        healthy | unavailable | configuration_error | auth_error
  dto.ts              — PasumithraAdminDto / PasumithraUserSummaryDto / PasumithraListingSummaryDto
                        / PasumithraDashboardSummaryDto — explicit field allowlists, never a raw
                        Firestore document
  mappers.ts          — raw doc → DTO (explicit field-by-field mapping, drops everything else)
  pasumithraAdapter.ts — the adapter class: getInfo, getHealth, listUsers, listEntities,
                        getAnalyticsSummary (all four required by the shared AppAdapter
                        interface), plus listAdmins (Pasumithra-specific, not part of the shared
                        interface — mirrors how "admins" is a Pasumithra-only concept)
  index.ts            — getPasumithraAdapter() singleton factory
```

Method set implemented — exactly the set named in `docs/INTEGRATION-STRATEGY.md`'s own "what
Pasumithra's adapter should do, in order" §1 (read-only first), plus `listAdmins()` for the
Administrators UI section, which is a Pasumithra-specific method the shared `AppAdapter`
interface does not (and should not) define:

- `getInfo()` — static metadata (satisfies `AppAdapter`)
- `getHealth()` — see "Health check design" below (satisfies `AppAdapter`)
- `listUsers(params?: { limit?: number })` — from `users` (satisfies `AppAdapter`)
- `listEntities('listings', params?: { limit?: number; status?: string })` — from `listings`
  (satisfies `AppAdapter`)
- `getAnalyticsSummary()` — mirrors `admin.js`'s `getOperationsDashboard()` +
  `getListingsByCategory()`/`getListingsByDistrict()`, computed via the same
  `getCountFromServer`-equivalent aggregation queries on the Admin SDK (satisfies `AppAdapter`)
- `listAdmins()` — from `admins` (Pasumithra-specific)

**Deliberately not implemented**: `getUser(id)` / a generic single-record fetch. Nothing in the
Phase 4 frontend scope (health, connectivity, last check, dashboard summary, administrators,
statistics) needs a per-record detail view, and the shared `AppAdapter` interface's `getUser` is
optional — adding it now with no caller would be exactly the "unnecessary endpoint" your
instructions ask to avoid. Trivial to add later if a detail view is wanted.

## Health check design

`AppAdapter.HealthStatus.status` was widened from the Phase 1 placeholder (`"up"|"down"|"unknown"`)
to a generic, reusable four-value union — useful for *any* future adapter, not Pasumithra-specific:

- **`healthy`** — a real Firestore read against the configured project succeeded.
- **`configuration_error`** — required env vars (`PASUMITHRA_FIREBASE_PROJECT_ID`,
  `PASUMITHRA_FIREBASE_CLIENT_EMAIL`, `PASUMITHRA_FIREBASE_PRIVATE_KEY`) are missing or malformed.
  Detected *before* any network call — never attempts a request with known-bad config.
- **`auth_error`** — the credential was rejected by Google (invalid/expired service account,
  insufficient IAM). Detected by classifying the Firestore/Firebase error's code/message
  (`permission-denied`, `unauthenticated`, `invalid_grant`, `app/invalid-credential`, etc.).
- **`unavailable`** — Firestore was unreachable (network/timeout/`unavailable` gRPC code) or the
  error didn't match a known auth/config pattern (safe default — never reports `healthy` on an
  error it can't positively classify).

The Central Admin never reports Pasumithra itself as "fully healthy" merely because Firestore
answered — the health response is explicitly scoped as "Firebase connectivity," and the
frontend labels it exactly that, not "Pasumithra is healthy."

## Central Admin API

All routes under `/api/pasumithra`, all requiring a valid Central Admin JWT **and** the
`pasumithra:read` permission (see RBAC below). None accept a body; none perform a write.

| Method | Path | Adapter call | Audit action |
|---|---|---|---|
| GET | `/api/pasumithra/health` | `getHealth()` (result persisted to `health_checks`) | `INTEGRATION_HEALTH_CHECKED` |
| GET | `/api/pasumithra/dashboard` | `getAnalyticsSummary()` | `INTEGRATION_DATA_ACCESSED` (`resource: "dashboard"`) |
| GET | `/api/pasumithra/admins` | `listAdmins()` | `INTEGRATION_DATA_ACCESSED` (`resource: "admins"`) |
| GET | `/api/pasumithra/users` | `listUsers({ limit })` | `INTEGRATION_DATA_ACCESSED` (`resource: "users"`) |
| GET | `/api/pasumithra/listings` | `listEntities('listings', { limit, status })` | `INTEGRATION_DATA_ACCESSED` (`resource: "listings"`) |

Both audit action names are **generic** (not `PASUMITHRA_*`) with the app identified in
`metadata.applicationSlug` — so JeevaMitra's/NearSip's future adapters reuse the same two audit
actions instead of each adapter inventing its own, per the "stay generic across apps" rule.

Every route: on any adapter error (config/auth/unavailable), responds `503` with a sanitized
message (`"Pasumithra integration is not reachable right now."` style) and the classified
`code` — **never** the raw Firebase error, stack trace, or credential details.

## RBAC

New permission: **`pasumithra:read`** — added to the existing `Permission` catalogue (no schema
change; it's data, via `rbacSeed.service.ts`). **Not** granted to the `ADMIN` role by default —
only `SUPER_ADMIN` has it (implicitly, like every permission). This is a deliberate, minimal
choice: it reuses the *existing* role/permission model exactly as Phase 1 built it (no new
`admin_user_apps` per-app-scoping table, which would be a bigger architectural change than this
phase asked for) while still satisfying "do not simply grant every admin unrestricted access" —
an `ADMIN` gets Pasumithra visibility only if a Super Admin deliberately extends their role's
grants. See `docs/PHASE-4-PASUMITHRA-INTEGRATION.md` §L for the known gap this creates (no UI
yet to edit a role's permission set) and the recommended follow-up.

## Data safety / DTOs

Every response is an explicit, allowlisted DTO (`dto.ts` + `mappers.ts`) — never a spread of a
raw Firestore document:

- `PasumithraAdminDto`: `id, email, name, role, createdAt`.
- `PasumithraUserSummaryDto`: `id, name, phone, isBlocked, sellerVerified, joinedAt`. (`phone` is
  kept because it's exactly what the existing admin-portal's own Users page already shows to
  every Pasumithra admin for moderation/contact purposes — not "unnecessary personal
  information" beyond what the source app itself treats as necessary.)
- `PasumithraListingSummaryDto`: `id, title, category, breed, district, price, status,
  sellerName, postedAt`. (`sellerPhone` and `imageUrls` are deliberately **excluded** — not
  needed for the Phase 4 summary table, and dropping them reduces exposed PII/bandwidth versus
  the full document.)
- `PasumithraDashboardSummaryDto`: the aggregate counts from §2/§4 plus `listingsByCategory` /
  `listingsByDistrict` breakdowns — no per-record data at all.

No password, token, service-account, or other credential field exists on any Pasumithra
Firestore document this adapter reads, so there is nothing of that kind to accidentally leak —
verified by cross-checking every field above against the actual `admin.js`/`firestore.rules`
source.
