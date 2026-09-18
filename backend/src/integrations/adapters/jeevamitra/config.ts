// Loads and validates this adapter's own Firebase credential configuration.
// Deliberately NON-THROWING: a missing/malformed config becomes a
// "configuration_error" health status (see errorClassification.ts) rather
// than crashing the whole Central Admin backend — JeevaMitra credentials
// are allowed to be absent in an environment where this integration hasn't
// been provisioned yet.
//
// Mirrors backend/src/integrations/adapters/pasumithra/config.ts exactly —
// same three mutually exclusive modes, chosen explicitly, never guessed or
// silently fallen back between. See docs/JEEVAMITRA-ADAPTER.md "Credential
// architecture":
//   emulator        — FIRESTORE_EMULATOR_HOST is set; only a project id is
//                     needed (the emulator ignores credentials entirely).
//   adc             — JEEVAMITRA_FIREBASE_AUTH_MODE=adc. Uses Google
//                     Application Default Credentials (local gcloud
//                     impersonation of central-admin@jeevamitra..., an
//                     attached GCE/Cloud Run service-account identity in
//                     production, or Workload Identity Federation outside
//                     GCP) — no private key of any kind is read here. This
//                     is the only mode actually intended for use in this
//                     project (see docs/JEEVAMITRA-ADAPTER.md).
//   service_account — JEEVAMITRA_FIREBASE_AUTH_MODE=service_account. Kept
//                     as a supported fallback for architectural consistency
//                     with the Pasumithra adapter — not used for JeevaMitra
//                     today, and no JSON key is created or requested by
//                     this codebase either way.
//
// Every value here is read only from environment variables, kept only in
// memory, and never logged, returned in an API response, or sent to the
// frontend — see docs/INTEGRATION-STRATEGY.md "Credential handling rules".

export type JeevaMitraConfig =
  | { mode: "emulator"; projectId: string }
  | { mode: "adc"; projectId: string }
  | { mode: "service_account"; projectId: string; clientEmail: string; privateKey: string };

export type JeevaMitraConfigResult = { ok: true; config: JeevaMitraConfig } | { ok: false; reason: string };

function normalizePrivateKey(raw: string): string {
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

export function loadJeevaMitraConfig(): JeevaMitraConfigResult {
  const projectId = process.env.JEEVAMITRA_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return { ok: false, reason: "JEEVAMITRA_FIREBASE_PROJECT_ID is not set." };
  }

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return { ok: true, config: { mode: "emulator", projectId } };
  }

  const authMode = process.env.JEEVAMITRA_FIREBASE_AUTH_MODE;
  if (!authMode) {
    return {
      ok: false,
      reason: 'JEEVAMITRA_FIREBASE_AUTH_MODE is not set. Set it to "adc" or "service_account".',
    };
  }
  if (authMode !== "adc" && authMode !== "service_account") {
    return {
      ok: false,
      reason: `JEEVAMITRA_FIREBASE_AUTH_MODE must be "adc" or "service_account" (got "${authMode}").`,
    };
  }

  if (authMode === "adc") {
    return { ok: true, config: { mode: "adc", projectId } };
  }

  const clientEmail = process.env.JEEVAMITRA_FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.JEEVAMITRA_FIREBASE_PRIVATE_KEY;

  if (!clientEmail) {
    return { ok: false, reason: "JEEVAMITRA_FIREBASE_CLIENT_EMAIL is not set." };
  }
  if (!privateKeyRaw) {
    return { ok: false, reason: "JEEVAMITRA_FIREBASE_PRIVATE_KEY is not set." };
  }

  return {
    ok: true,
    config: { mode: "service_account", projectId, clientEmail, privateKey: normalizePrivateKey(privateKeyRaw) },
  };
}
