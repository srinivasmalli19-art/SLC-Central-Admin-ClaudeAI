# SLC Application Inventory

Discovery date: 2026-09-17. Compiled by direct source inspection of every repository
found on the local machine under the GitHub account `srinivasmalli19-art`. No GitHub
API/`gh` CLI was available in this environment, so this inventory is based on locally
cloned repos only — it may not be a complete list of every repo on the account.

Repos inspected (paths as found locally):

| # | App | Local path | GitHub repo |
|---|---|---|---|
| 1 | SLC Apps Portal (marketing site) | `~/Repos/slc-apps-portal` | `SLC-Apps` |
| 2 | SLC GPS Camera | `~/Repos/gps_map_camera_pro` | `gps_map_camera_pro` |
| 3 | JeevaMitra | `~/Repos/jeevamitra` | `Jeevamitra` |
| 4 | Pasumithra (web + admin-portal + mobile shell) | `~/Repos/pasumithra-Web-application` | `pasumithra-Web-application` |
| 5 | Pasumitra (original) | `~/Repos/pasumitra-original` | `pasumitra-original` |
| 6 | NearSip | `~/Repos/nearsip` | `nearsip` |
| 7 | Pasunestam | `~/Documents/pasunestam` | `pasunestam` |
| 8 | `SLC-Apps` (empty scaffold repo, 0 commits) | `~/Repos/SLC-Apps` | unknown | — not a real app, excluded below |

---

## 0. SLC Apps Portal (marketing site)

- **Repository**: `SLC-Apps`
- **Platform**: Public website, `slcvet.com`
- **Frontend**: React 19 + Vite 8 + React Router 7, no backend of its own
- **Backend**: None — fully static, prerendered (`scripts/prerender.mjs`) for Google Play policy-URL crawlers
- **Database**: None
- **Authentication**: None
- **Deployment**: Cloudflare Pages, custom domains `slcvet.com` / `www.slcvet.com`; GoDaddy is DNS-only registrar
- **Administrative entities**: None — this is copy/marketing content only (`src/data/apps.js` lists the 4 publicly-announced apps: SLC GPS Camera, JeevaMitra, Pasumithra, SLC Vet "coming soon")
- **Existing APIs**: None
- **Integration difficulty**: N/A — not an operational application
- **Recommended integration method**: N/A. Note: this repo's `apps.js` is the canonical list of *publicly announced* products and should be treated as source-of-truth for branding/slugs, but it is **independent code** (its own README says so explicitly) — it has no runtime relationship to any backend.
- **Security considerations**: None applicable (no data, no auth).
- **Open question for the user**: The portal lists **SLC Vet** as "coming soon" with no repo of that exact name found locally. `pasunestam` (see below) is a veterinary-domain app under active development that is *not* on the public site — it may or may not be the intended "SLC Vet" product. This should be confirmed with the user before assuming they're the same product.

---

## 1. SLC GPS Camera

- **Application name**: SLC GPS Camera (internally "SLC GPS Map Camera Pro")
- **Repository**: `gps_map_camera_pro`
- **Platform**: Android (iOS/Web scaffolded but not built out — `flutter_launcher_icons` explicitly disables both)
- **Frontend technology**: Flutter/Dart (Dart `>=3.0.0 <4.0.0`), Provider for state, 18 Dart files
- **Backend technology**: **None.** Confirmed via full-repo search: no Firebase, no Supabase, no app-specific server. The only network calls are direct client-side `http.get()` calls to Google's public Geocoding and Static Maps APIs.
- **Database**: None (photos saved straight to OS gallery via `gal`; `shared_preferences` used only for local onboarding/splash flags)
- **Authentication**: None — no login, no accounts, no identity of any kind
- **Deployment**: Codemagic CI (`codemagic.yaml`) — Android release/debug APK builds, emailed to the developer; **no automated Play Store publishing step**. A local PowerShell script (`build_apk.ps1`) is also used for manual builds.
- **Administrative entities**: **None.** No users, no content, no moderation queue — nothing to administer.
- **Existing APIs**: None exposed by the app itself.
- **Integration difficulty**: **Not applicable / not integrable as-is.** There is no backend, no data, and no admin surface to connect a Central Admin to. Any "integration" would mean building an entire backend from scratch first, which is out of scope for this exercise.
- **Recommended integration method**: **Do not integrate.** Optionally list it in the Application Registry as a "static/no-backend" entry purely for inventory completeness (status/version tracking only, no live health check possible beyond "does the Play listing exist").
- **Security considerations** (flagged for the user's separate attention, not part of Central Admin scope):
  - A live Google Maps API key is hardcoded in `lib/constants/app_constants.dart` and `AndroidManifest.xml`, committed to git.
  - `android/key.properties` (the actual Android release-keystore **passwords**, not just a public cert) is committed to git in plaintext.
  - `upload_certificate.pem` (a public upload cert, lower risk) is also committed.
  - **Recommendation**: rotate/restrict the Maps API key in Google Cloud Console (HTTP referrer / package+SHA-1 restrictions) and remove `key.properties` from git history (`git filter-repo` or BFG) independent of this Central Admin project — this is a pre-existing issue unrelated to the admin platform.

---

## 2. JeevaMitra

- **Application name**: JeevaMitra
- **Repository**: `Jeevamitra`
- **Platform**: Android, iOS, macOS, Web, Windows (Flutter multi-platform)
- **Frontend technology**: Flutter/Dart 3.5+, Riverpod 2.5 (manual, no codegen), go_router 14. Note: repo contains two parallel, seemingly-mid-migration architectures (`lib/features/*` legacy vs. `lib/presentation/*` clean-architecture) — worth clarifying with the dev team which is authoritative before building against it.
- **Backend technology**: Firebase Cloud Functions (2nd-gen, Node 20) — but only **2 Firestore-triggered background functions** exist (`sendNotificationPush`, `onDiseaseAlertCreated`). **No HTTPS/callable functions, no REST API of any kind.** All client-server interaction is the Flutter app talking directly to Firestore, gated by security rules.
- **Database**: Firestore, project `jeevamitra`. Main collections: `users`, `farms` (+ `blocked_periods` subcollection), `fodder_plots`, `bookings`, `reviews`, `vets`, `disease_alerts`, `notifications`, `conversations` (+ `messages`), `emergency_contacts`, `analytics`.
- **Authentication**: Firebase Auth, **phone number + OTP only**. No email/password, no social login.
- **Deployment**: Firebase project `jeevamitra` (Firestore rules/indexes, Storage rules, Functions deployed via Firebase CLI); no Hosting configured; no CI — manual `firebase deploy` / Play Store upload.
- **Administrative entities**: **None built.** No `isAdmin()` rule, no custom claims, no role field beyond the business-domain `role` ('farmer'/'shepherd', explicitly documented in code as "never a permission"), no admin UI, no hardcoded admin allowlist anywhere in the app.
- **Existing APIs**: **None.** The two Cloud Functions are background triggers, not a callable/HTTP surface.
- **Integration difficulty**: **High** relative to its peers — not because the data model is complex, but because *all* privileged-access infrastructure (claims, admin rules, an API surface) needs to be built from zero before a Central Admin can safely touch this app's data. Direct Firestore access via a Central Admin service account is technically possible immediately, but any *write* path (e.g. banning a user, resolving a disease alert) has no existing safety rail to build on.
- **Recommended integration method**: Firebase Admin SDK service account scoped to project `jeevamitra`, read-only to start (user directory, bookings, disease alerts, moderation-style views) via the Central Admin backend's adapter layer. Defer write capabilities until a matching `isAdmin()` claim + Firestore rule update is deliberately added to this app's own `firestore.rules` (a small, additive change to the app, not a rewrite).
- **Security considerations**:
  - Firebase **client** config files (`google-services.json`, `GoogleService-Info.plist` ×2) are committed to git — normal/expected for Firebase client apps, low risk.
  - Two Android release keystores exist on disk but are correctly **git-ignored** (not committed) — good hygiene. One is named `pasumitra-upload-keystore.jks`, which is worth a quick check with the developer to confirm it isn't accidentally the *other* app's signing key living in the wrong repo.
  - No service-account JSON or secrets found committed.

---

## 3. Pasumithra (web app + admin portal + mobile shell)

- **Application name**: Pasumithra — livestock buy/sell marketplace
- **Repository**: `pasumithra-Web-application`
- **Platform**: Web (consumer + separate admin site) and Android/iOS via Capacitor-wrapped build of the same web bundle (not a distinct native codebase)
- **Frontend technology**: React 18 + Vite 5, Tailwind CSS, React Router 6, recharts (admin analytics). Firebase JS SDK v10 (client SDK — no `firebase-admin`, anywhere in this repo).
- **Backend technology**: **None — no Cloud Functions directory exists at all.** All application logic, including every admin-portal privileged operation, runs as direct **client-side Firestore SDK** reads/writes gated purely by `firestore.rules`.
- **Database**: Firestore, project `pasumithra-adc10`, shared by both the consumer web-app and the admin-portal (same project, same Auth users, same Storage bucket). Main collections: `users`, `listings` (+ `healthRecords` subcollection), `conversations` (+ `messages`), `favorites`, `notifications`, `admins`, `config`, `referenceData`, `animalTypes`, `breeds`, `diseases`, `vaccines`, `searchMeta`, `reports`.
- **Authentication**: Firebase Auth. Consumers: phone/OTP. Admin-portal staff: email/password, separate login flow. **RBAC = a Firestore existence check**, `isAdmin() = exists(/admins/{uid})` — not a custom claim. First admin self-provisions via a one-time `/setup` route; all subsequent admins are added manually via Firebase Console (deliberately, to prevent self-escalation).
- **Deployment**: Single Firebase project `pasumithra-adc10`, two Hosting targets — `web` (`pasumithra-adc10.web.app`, custom domain `pasumitra.com`) and `admin` (`pasumithra-admin.web.app`, intended custom domain `admin.pasumitra.com` — found misconfigured in the app's own production audit). No CI.
- **Administrative entities**: The most mature admin surface in the ecosystem — a **fully built React admin-portal** already covering: Users (block/unblock/verify), Listings (status/moderation/delete), Master Data (Animal Types, Breeds, Diseases, Vaccines — CRUD + CSV import/export + soft delete), Moderation (reports queue), Notifications (broadcast/targeted, in-app only, no FCM push), Reports (read-only analytics: totals, listings by category/district).
- **Existing APIs**: **None** — no REST endpoint, no callable function; "API surface" is implicit Firestore access via the client SDK and security rules only.
- **Integration difficulty**: **Low-to-medium.** The data model is already fully documented (rules, indexes, and a whole admin UI built against it), and there's no Cloud Functions layer to reverse-engineer around — a Central Admin backend can talk to the *exact same* Firestore collections the existing admin-portal already uses, via its own Firebase Admin SDK service account for project `pasumithra-adc10`. The app's own `KNOWN_LIMITATIONS.md` / `VERSION2_BACKLOG.md` explicitly name the gaps (no audit log, no admin-provisioning API, no real Firebase Auth account deletion, no FCM push) that a Central Admin with real backend access is well-positioned to fill — so integration adds capability rather than duplicating it.
- **Recommended integration method**: Firebase Admin SDK service account for `pasumithra-adc10`, used server-side only by a dedicated adapter in the Central Admin backend. Read: users, listings, reports, master data, analytics. Write (moderation actions, master-data edits, admin provisioning): route through the Central Admin backend so every write is captured in the new Central Admin audit log — something this app has never had.
- **Security considerations**:
  - The `admins` collection is **publicly readable** (`allow read: if true`) — a documented, accepted risk in the app's own `KNOWN_LIMITATIONS.md`, exposing admin email/name/role to anyone who knows a UID. Worth fixing independent of Central Admin (tighten the rule to `isAdmin()`).
  - `admin-portal/.env` and `web-app/.env` are committed to git — contents are Firebase **client-side web config** (apiKey/projectId etc.), which Firebase itself treats as non-secret/public-by-design, so this is a hygiene issue, not a credential leak.
  - No service-account/private-key material found committed anywhere.

---

## 4. Pasumitra (original)

- **Application name**: Pasumitra (original/legacy)
- **Repository**: `pasumitra-original`
- **Platform**: Flutter (Android)
- **Frontend technology**: Flutter/Dart
- **Backend / Database / Auth**: Not deep-dived — single "Initial commit: Pasumitra Flutter app - complete codebase" with no further history, strongly suggesting this is a **superseded predecessor** to `pasumithra-Web-application`'s later mobile shell (Capacitor-wrapped web build), not an actively maintained, separate product.
- **Deployment**: Unknown/likely none in production.
- **Administrative entities**: Not assessed — low value given apparent supersession.
- **Existing APIs**: Not assessed.
- **Integration difficulty**: N/A
- **Recommended integration method**: **Exclude from Central Admin scope.** Recommend confirming with the user that this repo is dead/archived rather than spending discovery effort on it. If it turns out to still be the live production Play Store app (with `pasumithra-Web-application`'s Capacitor shell being the *not-yet-released* replacement), that changes the integration target and should be flagged back to this document.

---

## 5. NearSip

- **Application name**: NearSip — "find nearby drink shops and food courts using GPS"
- **Repository**: `nearsip`
- **Platform**: Flutter, multi-platform scaffolding present (Android/iOS/Web/macOS/Linux/Windows) but only Android/consumer-mobile use appears real
- **Frontend technology**: Flutter/Dart 3.10+, go_router, Material 3 dark theme
- **Backend technology**: **Supabase** (Postgres + Auth + one Edge Function). Project ref `slrhmbpokagxfushsdyj`. One Deno Edge Function, `get-directions`, proxies Google's Routes API server-side (keeping that Google API key off the client) — per the repo's own sprint report, written and locally tested but **not confirmed actually deployed** (no CLI session was available when it was last touched).
- **Database**: Supabase Postgres — tables `places`, `reviews`, `profiles` (base tables, created directly in the Supabase Dashboard, no migration file in-repo), plus `favorites` and `content_submissions` (fully defined via in-repo SQL with RLS). RLS state for `places`/`reviews`/`profiles` is **not verifiable from the repo** — must be checked live in the Supabase Dashboard.
- **Authentication**: Supabase Auth, email/password, for end users. **Admin login is a hardcoded client-side email/password check in Dart code** (`lib/admin/auth/admin_auth.dart`) — not backed by Supabase Auth roles or claims, and provides no real server-side authorization boundary around the admin CRUD operations that follow it.
- **Deployment**: No CI/CD found anywhere (no GitHub Actions, no Codemagic, no Fastlane). 17 commits over about 3 weeks; commit messages and an explicit internal validation report both indicate this is **early/active development, not confirmed live in production** — consistent with its absence from the public marketing site.
- **Administrative entities**: An in-app `/admin` section (dashboard, places, reviews, users) exists in the same Flutter binary, doing direct Supabase CRUD with no role-scoped query filtering — authorization depends entirely on the weak client-side gate above plus whatever RLS actually exists live.
- **Existing APIs**: Supabase's auto-generated PostgREST API over `places`/`reviews`/`favorites`/`profiles`/`content_submissions`, plus the `get-directions` Edge Function (CORS-open, no JWT check in the function body itself).
- **Integration difficulty**: **Low technically** (Supabase PostgREST is the easiest API of any app in this inventory to consume — no custom backend to build), but **low priority** given the app isn't confirmed live/public yet, and its own admin security needs fixing regardless of any Central Admin integration.
- **Recommended integration method**: Defer. If/when this app goes to production, integrate via a Supabase service-role-key adapter (server-side only, in the Central Admin backend — never in the Flutter client) calling PostgREST directly. **Independently of Central Admin**, recommend replacing the hardcoded admin password check with real Supabase Auth + a role column/claim before this app is public, since anyone who decompiles the app can recover that check today.
- **Security considerations**:
  - Hardcoded client-side admin credential check (see above) — a real, exploitable weakness in the *existing* app, unrelated to whether Central Admin integrates or not.
  - Google Maps/Places API key committed in `web/index.html` and `AndroidManifest.xml` — normal only if restricted in Google Cloud Console (unconfirmed from repo).
  - No `.env`, service-role key, or other server secret found committed. The `GOOGLE_DIRECTIONS_API_KEY` is correctly server-only (`Deno.env.get`), never in the client bundle.

---

## 6. Pasunestam

- **Application name**: Pasunestam (working name — a veterinary field-officer's certificate/desk tool)
- **Repository**: `pasunestam`
- **Platform**: Web (Next.js), targeting veterinary officers primarily, with a public certificate-verification page
- **Frontend technology**: Next.js 16 (App Router), React 19, TypeScript, zod for validation, Vitest for tests; no UI component library (hand-written CSS per feature)
- **Backend technology**: Next.js **Server Actions only** — no `app/api/` REST routes exist. All Firestore/Storage access goes through `firebase-admin` **server-side exclusively**; the client Firebase SDK is never used. Session auth uses Firebase Identity Toolkit REST calls + `firebase-admin`-issued session cookies (14-day). A documented platform limitation: real cryptographic session verification can't run in Vercel's lightweight "Proxy" (middleware) layer on this Next.js version due to an ESM dependency issue, so route protection there is "cookie exists" only, with the real check happening in Server Actions/Components downstream.
- **Database**: Firestore, project `pasunestam-a753a`. **`firestore.rules` and `storage.rules` are both fully deny-all for any client access** — everything is mediated by the trusted server. Collections: `profiles` (role: vet/editor/admin), `certificateTemplates`, `certificates`, `certificateNumberCounters` (transactional sequential numbering), `schemes`, `schemeApplications`, `articles`, `admissions`, `products`, `cases`.
- **Authentication**: Firebase Auth via Identity Toolkit REST (email/password), server-issued session cookies. Roles (`vet`/`editor`/`admin`) exist on the `profiles` doc, but **only one role check exists in the whole codebase today** (cross-vet certificate cancellation) — everything else with a role field is otherwise unused/unenforced.
- **Deployment**: Vercel (Next.js default), Firebase used only as managed Auth+Firestore+Storage — no Firebase Hosting, no Cloud Functions.
- **Administrative entities**: **No `/admin` section exists yet** — the codebase has a placeholder protected-route prefix (`/admin`) wired into the proxy layer, but nothing built behind it. Certificate template management and content moderation/curation currently happen only via developer-run seed scripts or direct Firestore console edits.
- **Existing APIs**: None externally callable — only internal Server Actions (`saveDraftCertificate`, `issueCertificate`, `cancelCertificate`, `addScheme`, `submitCase`, etc.), which are not reachable from outside this Next.js app without adding real `app/api/` route handlers.
- **Integration difficulty**: **High right now, mainly because the product itself is pre-admin-UI.** There's nothing an admin platform would "attach to" yet beyond direct Firestore access, and the app would need new `app/api/*` routes added (a small, additive change, not a rewrite) before Central Admin could integrate without duplicating `firebase-admin` credentials into a second codebase.
- **Recommended integration method**: Defer until this app either (a) ships its own `/admin` basics, or (b) gets a thin set of `app/api/*` routes wrapping its existing `lib/*/queries.ts`/`actions.ts` logic for Central Admin to call. In the meantime, read-only visibility (certificate issuance volume, scheme applications) is possible via a Firebase Admin SDK service account for `pasunestam-a753a`, same pattern as the other Firebase apps.
- **Security considerations**: Best practice in the ecosystem — Admin SDK credentials only via `process.env`, never hardcoded; deny-all Firestore rules; public Firebase Web API key is intentionally public per Firebase's own design. No issues found.
- **Open question for the user**: this app's domain (veterinary certificates/schemes for field officers) strongly overlaps with the portal's "SLC Vet — coming soon" listing. Confirm whether `pasunestam` *is* the SLC Vet product before assuming they are separate.

---

## Summary comparison table

| App | Backend | DB | Auth | Existing admin UI | Existing API | Integration difficulty | Live in prod? |
|---|---|---|---|---|---|---|---|
| SLC GPS Camera | None | None | None | None | None | N/A (nothing to integrate) | Yes (Play Store, manual builds) |
| JeevaMitra | 2 Firestore-trigger functions only | Firestore (`jeevamitra`) | Firebase Auth (phone/OTP) | None | None | High (no RBAC infra at all) | Yes |
| Pasumithra | None (client-SDK only) | Firestore (`pasumithra-adc10`) | Firebase Auth (phone/OTP consumers, email/pw admins) | **Yes — full React admin-portal** | None | **Low-to-medium** | Yes |
| Pasumitra (original) | Unknown | Unknown | Unknown | Unknown | Unknown | N/A — likely superseded | Unclear |
| NearSip | Supabase (Postgres + 1 Edge Fn) | Supabase Postgres | Supabase Auth (users) + hardcoded client check (admin, weak) | Yes, but insecure | PostgREST auto-API | Low technically, low priority | No (early dev) |
| Pasunestam | Server Actions only, `firebase-admin` | Firestore (`pasunestam-a753a`) | Firebase Auth + session cookies | None yet | None externally | High (pre-admin-UI) | Unclear/early |

