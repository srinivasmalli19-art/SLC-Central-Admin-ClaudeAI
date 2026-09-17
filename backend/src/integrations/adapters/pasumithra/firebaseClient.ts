import { cert, deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { loadPasumithraConfig } from "./config.js";

export class PasumithraConfigurationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PasumithraConfigurationError";
  }
}

// A named App instance ("pasumithra"), isolated from any other adapter's
// Firebase project — each adapter that talks to Firebase gets its own named
// app, since firebase-admin's default app can only ever point at one
// project at a time and this backend will eventually hold credentials for
// several different Firebase projects at once (see docs/ARCHITECTURE.md).
const APP_NAME = "pasumithra";

function getOrCreateApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const result = loadPasumithraConfig();
  if (!result.ok) {
    throw new PasumithraConfigurationError(result.reason);
  }

  const { config } = result;

  if (config.usingEmulator) {
    return initializeApp({ projectId: config.projectId }, APP_NAME);
  }

  return initializeApp(
    {
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
    },
    APP_NAME,
  );
}

export function getPasumithraFirestore(): Firestore {
  return getFirestore(getOrCreateApp());
}

// Test-only: firebase-admin apps are process-wide singletons keyed by name,
// so tests that need to reconfigure the adapter (e.g. simulate a missing
// env var, then a valid one) must tear the named app down first.
export async function resetPasumithraFirebaseAppForTests(): Promise<void> {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) {
    await deleteApp(existing);
  }
}
