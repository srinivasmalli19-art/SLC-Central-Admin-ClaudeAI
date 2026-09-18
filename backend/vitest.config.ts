import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 15000,
    hookTimeout: 20000,
    fileParallelism: false, // tests share one Postgres database — run serially
    setupFiles: ["./tests/setup.ts"],
    env: {
      // Test-only fixture values — never real credentials, never used
      // outside this local test database. See docs/PHASE-1-IMPLEMENTATION.md.
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? `postgresql://${process.env.USER ?? ""}@localhost:5432/slc_central_admin_test`,
      JWT_SECRET: "test-only-jwt-secret-not-a-real-credential-do-not-reuse",
      JWT_EXPIRES_IN: "1h",
      CORS_ORIGIN: "http://localhost:5173",
      LOG_LEVEL: "silent",
      // Explicitly force-unset every integration-adapter credential var,
      // regardless of what a developer's local .env happens to have set
      // for real local-dev use (e.g. after live ADC validation) — the main
      // suite must be deterministic and never depend on live GCP
      // credentials. Without this, dotenv's normal loading of the real
      // .env file would leak whatever is actually configured there into
      // these "no credentials configured" tests. See
      // tests/pasumithra.routes.test.ts / tests/jeevamitra.routes.test.ts.
      //
      // FIRESTORE_EMULATOR_HOST is the one exception: preserve it if
      // already set (e.g. by `firebase emulators:exec`, which exports it
      // into this process before vitest even starts, for the separate
      // test:pasumithra:emulator / test:jeevamitra:emulator scripts) —
      // only default it to unset when nothing set it.
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "",
      PASUMITHRA_FIREBASE_PROJECT_ID: "",
      PASUMITHRA_FIREBASE_AUTH_MODE: "",
      PASUMITHRA_FIREBASE_CLIENT_EMAIL: "",
      PASUMITHRA_FIREBASE_PRIVATE_KEY: "",
      JEEVAMITRA_FIREBASE_PROJECT_ID: "",
      JEEVAMITRA_FIREBASE_AUTH_MODE: "",
      JEEVAMITRA_FIREBASE_CLIENT_EMAIL: "",
      JEEVAMITRA_FIREBASE_PRIVATE_KEY: "",
    },
  },
});
