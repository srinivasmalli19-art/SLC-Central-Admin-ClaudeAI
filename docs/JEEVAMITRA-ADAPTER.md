# JeevaMitra Adapter — Integration Record (Phase 5B)

Status: **read-only, implemented**. This document is the integration record for the second
Central Admin adapter, built on the discovery in this repo's Phase 5A/5B conversation history
and mirroring the proven Pasumithra adapter pattern (`docs/PASUMITHRA-ADAPTER.md`) exactly where
applicable. Source inspected directly: `~/Repos/jeevamitra` (`firestore.rules`,
`firestore.indexes.json`, `lib/core/constants/firebase_constants.dart`,
`lib/domain/entities/*.dart`, `functions/index.js`, `lib/firebase_options.dart`, `.firebaserc`).

## 1. Firebase project

- Project ID: **`jeevamitra`** — cross-confirmed across four independent sources in JeevaMitra's
  own repo: `.firebaserc`, `firebase.json`, `lib/firebase_options.dart` (FlutterFire-generated),
  and `android/app/google-services.json` + `build.gradle.kts`'s `applicationId`. All agree
  exactly; no ambiguity (unlike the earlier Pasumithra project-ID confusion).
- Project number: `360739375700`.
- No Cloud Functions Admin SDK usage exists in JeevaMitra beyond its own two Firestore-trigger
  functions (`sendNotificationPush`, `onDiseaseAlertCreated`) — this Central Admin adapter is a
  new, separate Admin SDK client, isolated under its own named Firebase app (see below).

## 2 & 3. Firestore collections and fields actually used by this adapter

Quoted from `lib/core/constants/firebase_constants.dart` and `lib/domain/entities/*.dart` — no
collection or field name below is guessed.

| Collection | Fields this adapter reads | Fields deliberately excluded |
|---|---|---|
| `users` | `name`, `role` (`'farmer'\|'shepherd'`), `district`, `isVerified`, `createdAt` | `phone`, `village`, `state`, `profileImageUrl`, `lastActiveAt`, `preferredLanguage` — see §9 |
| `farms` | (count only — `isAvailable`) | Everything else (owner PII, exact `lat`/`lng`, `imageUrls`) — not read at all in Phase 5B, see "Deferred scope" |
| `bookings` | (count only — `status`) | Everything else (farmer/shepherd uids, financial amounts) — not read at all, see "Deferred scope" |
| `disease_alerts` | `disease`, `affectedSpecies`, `severity`, `district`, `isActive`, `issuedAt` | `symptoms`, `prevention`, `treatment`, `vetContactPhone`, `reportedBy`, `title`, `description`, `radiusKm`, `sourceAuthority` — see §9 |

Not read at all by this adapter: `vets`, `conversations`, `conversations/{id}/messages`,
`fodder_plots`, `farms/{id}/blocked_periods`, `reviews`, `notifications`, `emergency_contacts`,
`analytics`. See "Deferred scope" for why, and — specifically for
`conversations`/`messages` — a real security reason, not just a phasing choice.

## 4. Existing admin operations

**None exist in JeevaMitra** — unlike Pasumithra, there is no existing admin-portal, no admin
Firestore collection, and no custom claims of any kind (confirmed by repo-wide grep for
`setCustomUserClaims`/`getIdTokenResult`/`isAdmin` — zero matches). This Central Admin adapter is
the **first** administrative capability JeevaMitra has ever had.

## 5. Existing Firestore security rules (relevant excerpts, not paraphrased)

- No `isAdmin()` function exists in `firestore.rules` — ownership is the only access pattern
  (`isOwner(uid) = request.auth.uid == uid`).
- `users/{userId}`: `allow read, write: if isOwner(userId)` — owner-only, matching why this
  adapter must use the Admin SDK (which bypasses rules) to read any user other than "itself."
- `farms`, `fodder_plots`, `vets`, `disease_alerts`, `reviews`: public read for any signed-in
  user; owner-only write.
- `bookings`: `allow delete: if false` — no delete of any kind, ever, by anyone; deal terms
  immutable on update.
- **Security issue found during discovery, not fixed here**: `conversations/{id}/messages/{id}`
  has `allow read: if isSignedIn()` with **no participant check on the nested match** — Firestore
  does not inherit the outer `conversations` match's participant restriction for a nested
  subcollection path. This means any authenticated JeevaMitra user can currently read any other
  users' chat messages. This is a real, pre-existing gap in JeevaMitra's own rules, **not
  introduced by, fixed by, or related to this adapter** — flagged here only so it's documented
  alongside the explicit decision (see "Deferred scope") to never add a
  conversations/messages-reading feature to Central Admin until JeevaMitra's own team addresses
  it on their own release cycle.

## 6. Firebase Authentication

Phone number + OTP only (`FirebaseAuth.verifyPhoneNumber()`/`signInWithCredential()`). No custom
claims, no admin role of any kind. Central Admin's own JWT+RBAC system remains completely
independent — this adapter never calls the Firebase Auth Admin API at all (everything it needs —
name, role, district, verification status — already lives in the `users` Firestore document).

## 7. Cloud Functions

Two functions, both `onDocumentCreated` (create-triggers only, no HTTPS/callable functions):
`sendNotificationPush` (`notifications/{id}` → FCM push) and `onDiseaseAlertCreated`
(`disease_alerts/{id}` → fan-out `notifications` docs per district). Since this adapter performs
**only reads** and neither function triggers on anything but document *creation*, it is
structurally impossible for this adapter's queries to trigger either function.

## Adapter architecture

```
backend/src/integrations/adapters/jeevamitra/
  config.ts          — loads/validates JEEVAMITRA_FIREBASE_* env vars (non-throwing; a missing/
                        bad config becomes a "configuration_error" health status, never a crash).
                        Identical 3-mode design to the Pasumithra adapter: emulator | adc |
                        service_account — see "Credential architecture" below.
  firebaseClient.ts   — lazily initializes a *named* firebase-admin App ("jeevamitra"), isolated
                        from the Pasumithra adapter's app and any future adapter's app.
  errorClassification.ts — maps a raw Firestore/Firebase error into
                        healthy | unavailable | configuration_error | auth_error (duplicated from
                        the Pasumithra adapter rather than shared, to keep each adapter
                        self-contained — matches the existing per-adapter-folder convention).
  dto.ts / mappers.ts — JeevaMitraUserSummaryDto / JeevaMitraDiseaseAlertDto /
                        JeevaMitraDashboardSummaryDto — explicit field allowlists, never a raw
                        Firestore document. `phone` and every disease-alert free-text/contact
                        field are never read by the mappers at all (not merely omitted from the
                        DTO type — the mapper functions don't reference them), so there is no
                        code path by which they could leak even by future accident.
  jeevamitraAdapter.ts — the adapter class: getInfo, getHealth, listUsers, listEntities
                        (entityType 'disease_alerts' only), getAnalyticsSummary — the same four
                        AppAdapter-required methods the Pasumithra adapter implements. No
                        JeevaMitra-specific method beyond the shared interface was needed (unlike
                        Pasumithra's `listAdmins()` — JeevaMitra has no admin collection).
  index.ts            — getJeevaMitraAdapter() singleton factory
```

## Credential architecture

Identical design to the Pasumithra adapter's Phase 4A/4B hardening
(`docs/PASUMITHRA-ADAPTER.md` "Credential architecture"), applied to project `jeevamitra`:

- **`adc`** (the only mode actually used for this project) — `firebase-admin/app`'s
  `applicationDefault()`. Local dev impersonates the dedicated, least-privilege service account:
  ```
  gcloud auth application-default login \
    --impersonate-service-account=central-admin@jeevamitra.iam.gserviceaccount.com
  ```
  In production on Google Cloud (Cloud Run/GCE/Cloud Functions), the same service account would
  be attached directly to the compute resource — no key, no code change. Outside Google Cloud,
  `GOOGLE_APPLICATION_CREDENTIALS` would point at a Workload Identity Federation config file
  (not a private key). **No JSON service-account key is created, used, or requested anywhere in
  this integration.**
- **`emulator`** — `FIRESTORE_EMULATOR_HOST` set; used only by the test suite (see "Testing").
- **`service_account`** — kept as a supported code path for architectural consistency with the
  Pasumithra adapter, exactly as that adapter kept it. Not used for JeevaMitra.

**Required IAM** (already investigated and — per the preceding conversation turns —
provisioned): a dedicated service account `central-admin@jeevamitra.iam.gserviceaccount.com`,
holding **`roles/datastore.viewer` only** on project `jeevamitra`. Confirmed sufficient for every
operation this adapter performs (get/list/query/count — no write RPC exists anywhere in this
integration). Explicitly not granted or needed: Owner, Editor, Firebase Auth Admin/Viewer,
Storage Viewer, or any Cloud Functions permission.

## Health check design

Identical semantics to the Pasumithra adapter (`healthy | unavailable | configuration_error |
auth_error`, see `docs/PASUMITHRA-ADAPTER.md` "Health check design" for the full rationale).
JeevaMitra has no small, stable "admins"-like collection to probe (it has no admin collection at
all), so the health check reads `users` with `limit(1)` instead — the same cheap,
connectivity-and-permission-proving pattern applied to the nearest available small collection.

## Central Admin API

All routes under `/api/jeevamitra`, all requiring a valid Central Admin JWT **and** the
`jeevamitra:read` permission. None accept a body; none perform a write.

| Method | Path | Adapter call | Audit action |
|---|---|---|---|
| GET | `/api/jeevamitra/health` | `getHealth()` (result persisted to `health_checks` if a `jeevamitra` registry row exists — none was created in Phase 5B, see "Remaining items") | `INTEGRATION_HEALTH_CHECKED` |
| GET | `/api/jeevamitra/dashboard` | `getAnalyticsSummary()` | `INTEGRATION_DATA_ACCESSED` (`resource: "dashboard"`) |
| GET | `/api/jeevamitra/users` | `listUsers({ limit })` | `INTEGRATION_DATA_ACCESSED` (`resource: "users"`) |
| GET | `/api/jeevamitra/disease-alerts` | `listEntities('disease_alerts', { limit, isActive })` | `INTEGRATION_DATA_ACCESSED` (`resource: "disease_alerts"`) |

Both audit actions are the **same generic actions** the Pasumithra integration already uses
(`INTEGRATION_HEALTH_CHECKED`, `INTEGRATION_DATA_ACCESSED`) — no new audit action was added, per
the "stay generic across apps" principle in `docs/ARCHITECTURE.md`. Every route: on any adapter
error, responds `503` with a sanitized message and classified `code` — never the raw Firebase
error, stack trace, or credential details.

## RBAC

New permission: **`jeevamitra:read`**. Added to the existing `Permission` catalogue (data only,
no schema change). **Not** granted to the `ADMIN` role by default — only `SUPER_ADMIN` has it
(implicitly, like every permission) — same rationale and same mechanism as `pasumithra:read`
(see `docs/PASUMITHRA-ADAPTER.md` "RBAC"): reuses the existing role/permission model exactly,
no new `admin_user_apps` table was introduced.

## Read-only scope (implemented)

`getHealth()`, `getAnalyticsSummary()` (users by role; total/active farms; bookings by status;
active disease alerts by severity and by district), `listUsers()` (id/name/role/district/
isVerified/createdAt — **phone excluded**), `listEntities('disease_alerts')` (id/disease/
affectedSpecies/severity/district/isActive/issuedAt — symptoms/treatment/prevention/
vetContactPhone/reportedBy excluded).

## Deferred scope (deliberately not implemented)

Farms detail browsing, bookings detail browsing, vets directory, **conversations/messages**
(deferred specifically because of the real rules gap in §5 — not merely unscoped), Storage/image
access, and every write/delete/edit operation (user editing, disease-alert editing, Firebase Auth
administration, Cloud Functions administration). None of these have any code path in this
adapter at all — not stubbed, not partially built.

## Data safety / DTOs

Every response is an explicit, allowlisted DTO — never a spread of a raw Firestore document.
`JeevaMitraUserSummaryDto` and `JeevaMitraDiseaseAlertDto`'s mapper functions
(`mappers.ts`) don't even reference `phone`/`symptoms`/`treatment`/`prevention`/
`vetContactPhone`/`reportedBy` — there is no variable holding those values at any point in this
adapter's code, not merely a DTO field that's left unset.

## Testing

Mirrors the Pasumithra adapter's split exactly:

- **Main suite** (`npm test`) — 34 new tests, **no Firebase credentials or emulator required**:
  `config.test.ts` (AUTH_MODE/ADC resolution), `errorClassification.test.ts` (including the
  ADC-not-configured → `configuration_error` distinction and credential-non-leakage checks),
  `adapterFactory.test.ts` (singleton behavior), and `jeevamitra.routes.test.ts` (401/403/200
  RBAC, 503 sanitized error responses with no env-var names or stack traces, query validation,
  audit logging of both success and failure, and an explicit check that
  POST/PUT/PATCH/DELETE against every jeevamitra path 404s since no mutation route is
  registered at all).
- **Emulator suite** (`npm run test:jeevamitra:emulator`, via `firebase emulators:exec`, a fake
  `demo-jeevamitra` project id) — 10 tests: health, empty results, field mapping (including an
  explicit assertion that `phone` never appears on a mapped user even when present on the raw
  document), malformed-field handling, disease-alert field exclusion (symptoms/treatment/
  prevention/vetContactPhone/reportedBy), `isActive` filtering, unsupported-entity-type
  rejection, dashboard counts against seeded fixtures, and the unavailable-connection path. Real
  `auth_error` classification is unit-tested against synthetic error objects in
  `errorClassification.test.ts`, since the emulator itself cannot produce a genuine Google auth
  rejection (same documented limitation as the Pasumithra adapter's testing notes).

**No committed "live validation script" exists** — matching the existing repo convention (the
Pasumithra adapter's own live validation, done during Phase 4A/4B, was always a manual,
documented curl-based procedure, never a checked-in script). The equivalent manual procedure for
JeevaMitra: start the backend (`npm run dev --workspace backend` or `node backend/dist/server.js`
after `npm run build:backend`), log in as a Central Admin Super Admin, then call
`GET /api/jeevamitra/health`, `/dashboard`, `/users`, `/disease-alerts` with that token — this
requires `JEEVAMITRA_FIREBASE_PROJECT_ID=jeevamitra` and `JEEVAMITRA_FIREBASE_AUTH_MODE=adc` set
in `backend/.env`, and local ADC already configured to impersonate
`central-admin@jeevamitra.iam.gserviceaccount.com` (`gcloud auth application-default login
--impersonate-service-account=central-admin@jeevamitra.iam.gserviceaccount.com`).

## Real finding from live validation (fixed)

A live, read-only check against the actual `jeevamitra` project (via the impersonated
`central-admin@jeevamitra.iam.gserviceaccount.com` identity) surfaced a genuine defect before
this adapter shipped: `listUsers()` originally ordered by `createdAt`, matching
`lib/domain/entities/user_entity.dart`'s `required DateTime createdAt` field. Real production
`users` documents, however, do not reliably have a `createdAt` field at all (confirmed by
inspecting real field names, never real values) — likely schema drift from older documents
predating that entity field. Firestore's `orderBy` silently **excludes** any document missing
the ordered field, so `listUsers()` returned an empty list against real data despite the
dashboard's separate `.count()` query (which has no `orderBy`) correctly counting those same
users. **Fixed**: `listUsers()` no longer orders by `createdAt` — an unordered `limit()` read,
consistent with "handle missing/null/unknown fields safely." A regression test
(`tests/adapters/jeevamitra/emulator/jeevamitraAdapter.test.ts`) seeds a document with no
`createdAt` field at all and asserts it's still returned. Re-verified live after the fix: both
real users are now returned correctly, with `phone` still confirmed absent from every record.

## Remaining items (not done in Phase 5B — out of this task's explicit scope)

- **No frontend page and no Application Registry seed entry were added** — this task's
  instructions were backend-only (adapter, routes, RBAC, tests, docs); unlike the original
  Pasumithra Phase 4 task, a JeevaMitra frontend page/registry row was not requested. Without a
  registry row, `GET /api/jeevamitra/health` will log a harmless warning ("No 'jeevamitra'
  application registry row found") and skip persisting health-check history — the health
  endpoint itself still works correctly. Add a registry row (mirroring
  `seedPasumithraApplication` in `backend/prisma/seed.ts`) and a `JeevaMitraPage.tsx` (mirroring
  `PasumithraPage.tsx`) as a follow-up if/when a frontend view is wanted.
- The `conversations/messages` rules gap (§5) should be flagged to JeevaMitra's own maintainers
  — outside this repo's ability to fix, and not fixed here.
