// Loads and validates this adapter's own Firebase credential configuration.
// Deliberately NON-THROWING: a missing/malformed config becomes a
// "configuration_error" health status (see errorClassification.ts) rather
// than crashing the whole Central Admin backend — Pasumithra credentials
// are allowed to be absent in an environment where this integration hasn't
// been provisioned yet.
//
// Three mutually exclusive modes, chosen explicitly — never guessed or
// silently fallen back between, per docs/PASUMITHRA-ADAPTER.md "Credential
// architecture":
//   emulator        — FIRESTORE_EMULATOR_HOST is set; only a project id is
//                     needed (the emulator ignores credentials entirely).
//   adc             — PASUMITHRA_FIREBASE_AUTH_MODE=adc. Uses Google
//                     Application Default Credentials (gcloud user login,
//                     an attached GCE/Cloud Run service-account identity,
//                     or a Workload Identity Federation config file) — no
//                     private key of any kind is read by this codebase.
//   service_account — PASUMITHRA_FIREBASE_AUTH_MODE=service_account. Uses
//                     the original PASUMITHRA_FIREBASE_CLIENT_EMAIL /
//                     _PRIVATE_KEY env vars — kept as a supported fallback,
//                     not removed.
//
// Every value here is read only from environment variables, kept only in
// memory, and never logged, returned in an API response, or sent to the
// frontend — see docs/INTEGRATION-STRATEGY.md "Credential handling rules".

export type PasumithraConfig =
  | { mode: "emulator"; projectId: string }
  | { mode: "adc"; projectId: string }
  | { mode: "service_account"; projectId: string; clientEmail: string; privateKey: string };

export type PasumithraConfigResult = { ok: true; config: PasumithraConfig } | { ok: false; reason: string };

function normalizePrivateKey(raw: string): string {
  // .env files commonly store the PEM's newlines as the two-character
  // sequence \n — convert back to real newlines, and strip any accidental
  // wrapping quotes.
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

export function loadPasumithraConfig(): PasumithraConfigResult {
  const projectId = process.env.PASUMITHRA_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return { ok: false, reason: "PASUMITHRA_FIREBASE_PROJECT_ID is not set." };
  }

  // The Firestore emulator ignores credentials entirely — a project id is
  // enough to connect. Checked first, and independent of AUTH_MODE, so
  // every existing emulator test keeps working unchanged.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return { ok: true, config: { mode: "emulator", projectId } };
  }

  const authMode = process.env.PASUMITHRA_FIREBASE_AUTH_MODE;
  if (!authMode) {
    return {
      ok: false,
      reason: 'PASUMITHRA_FIREBASE_AUTH_MODE is not set. Set it to "adc" or "service_account".',
    };
  }
  if (authMode !== "adc" && authMode !== "service_account") {
    return {
      ok: false,
      reason: `PASUMITHRA_FIREBASE_AUTH_MODE must be "adc" or "service_account" (got "${authMode}").`,
    };
  }

  if (authMode === "adc") {
    return { ok: true, config: { mode: "adc", projectId } };
  }

  const clientEmail = process.env.PASUMITHRA_FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.PASUMITHRA_FIREBASE_PRIVATE_KEY;

  if (!clientEmail) {
    return { ok: false, reason: "PASUMITHRA_FIREBASE_CLIENT_EMAIL is not set." };
  }
  if (!privateKeyRaw) {
    return { ok: false, reason: "PASUMITHRA_FIREBASE_PRIVATE_KEY is not set." };
  }

  return {
    ok: true,
    config: { mode: "service_account", projectId, clientEmail, privateKey: normalizePrivateKey(privateKeyRaw) },
  };
}
