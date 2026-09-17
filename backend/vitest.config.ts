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
    },
  },
});
