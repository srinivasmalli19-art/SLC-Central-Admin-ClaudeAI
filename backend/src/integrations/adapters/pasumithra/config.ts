// Loads and validates this adapter's own Firebase credentials. Deliberately
// NON-THROWING: a missing/malformed config becomes a "configuration_error"
// health status (see errorClassification.ts) rather than crashing the whole
// Central Admin backend — Pasumithra credentials are allowed to be absent in
// an environment where this integration hasn't been provisioned yet.
//
// PASUMITHRA_FIREBASE_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY are read only
// here, kept only in memory, and never logged, returned in an API response,
// or sent to the frontend — see docs/INTEGRATION-STRATEGY.md "Credential
// handling rules".

export interface PasumithraConfig {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
  usingEmulator: boolean;
}

export type PasumithraConfigResult = { ok: true; config: PasumithraConfig } | { ok: false; reason: string };

function normalizePrivateKey(raw: string): string {
  // .env files commonly store the PEM's newlines as the two-character
  // sequence \n — convert back to real newlines, and strip any accidental
  // wrapping quotes.
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

export function loadPasumithraConfig(): PasumithraConfigResult {
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId = process.env.PASUMITHRA_FIREBASE_PROJECT_ID;

  if (!projectId) {
    return { ok: false, reason: "PASUMITHRA_FIREBASE_PROJECT_ID is not set." };
  }

  // The Firestore emulator ignores credentials entirely — a project id is
  // enough to connect. Outside the emulator, a real service account is
  // required for every read.
  if (usingEmulator) {
    return { ok: true, config: { projectId, usingEmulator: true } };
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
    config: { projectId, clientEmail, privateKey: normalizePrivateKey(privateKeyRaw), usingEmulator: false },
  };
}
