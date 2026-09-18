import { applicationDefault, cert, deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { loadJeevaMitraConfig } from "./config.js";

export class JeevaMitraConfigurationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "JeevaMitraConfigurationError";
  }
}

// A named App instance ("jeevamitra"), isolated from the Pasumithra
// adapter's app (and any future adapter's app) — each adapter that talks
// to Firebase gets its own named app, since firebase-admin's default app
// can only ever point at one project at a time and this backend holds
// credentials for multiple separate Firebase projects at once. See
// docs/ARCHITECTURE.md "Integration Adapter Layer".
const APP_NAME = "jeevamitra";

function getOrCreateApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const result = loadJeevaMitraConfig();
  if (!result.ok) {
    throw new JeevaMitraConfigurationError(result.reason);
  }

  const { config } = result;

  if (config.mode === "emulator") {
    return initializeApp({ projectId: config.projectId }, APP_NAME);
  }

  if (config.mode === "adc") {
    // No private key of any kind is read here. applicationDefault() defers
    // to the standard Google Auth Library resolution order: a gcloud user
    // login impersonating central-admin@jeevamitra.iam.gserviceaccount.com
    // locally, an attached service-account identity when running on GCP
    // (no key file involved), or a Workload Identity Federation config
    // file outside GCP — see docs/JEEVAMITRA-ADAPTER.md "Credential
    // architecture".
    return initializeApp({ credential: applicationDefault(), projectId: config.projectId }, APP_NAME);
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

export function getJeevaMitraFirestore(): Firestore {
  return getFirestore(getOrCreateApp());
}

// Test-only: firebase-admin apps are process-wide singletons keyed by name,
// so tests that need to reconfigure the adapter (e.g. simulate a missing
// env var, then a valid one) must tear the named app down first.
export async function resetJeevaMitraFirebaseAppForTests(): Promise<void> {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) {
    await deleteApp(existing);
  }
}
