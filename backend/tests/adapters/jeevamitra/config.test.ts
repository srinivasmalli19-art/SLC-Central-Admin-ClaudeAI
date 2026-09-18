import { afterEach, describe, expect, it, vi } from "vitest";
import { loadJeevaMitraConfig } from "../../../src/integrations/adapters/jeevamitra/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadJeevaMitraConfig", () => {
  it("reports not-ok when JEEVAMITRA_FIREBASE_PROJECT_ID is missing", () => {
    vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "");
    const result = loadJeevaMitraConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/PROJECT_ID/);
  });

  it("succeeds with only a project id when the Firestore emulator is configured (AUTH_MODE irrelevant)", () => {
    vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "demo-jeevamitra");
    vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8090");

    const result = loadJeevaMitraConfig();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.mode).toBe("emulator");
  });

  describe("outside the emulator — AUTH_MODE is required and never guessed", () => {
    it("reports not-ok when JEEVAMITRA_FIREBASE_AUTH_MODE is not set at all", () => {
      vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "jeevamitra");
      vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "");
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");

      const result = loadJeevaMitraConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/AUTH_MODE/);
    });

    it("reports not-ok when JEEVAMITRA_FIREBASE_AUTH_MODE is an unrecognized value", () => {
      vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "jeevamitra");
      vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "firebase-admin"); // not "adc" or "service_account"
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");

      const result = loadJeevaMitraConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/AUTH_MODE/);
    });
  });

  describe("AUTH_MODE=adc — Application Default Credentials, no private key", () => {
    it("succeeds with only a project id — no CLIENT_EMAIL/PRIVATE_KEY required", () => {
      vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "jeevamitra");
      vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "adc");
      vi.stubEnv("JEEVAMITRA_FIREBASE_CLIENT_EMAIL", "");
      vi.stubEnv("JEEVAMITRA_FIREBASE_PRIVATE_KEY", "");
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");

      const result = loadJeevaMitraConfig();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.config.mode).toBe("adc");
        expect(result.config.projectId).toBe("jeevamitra");
        // The adc branch of the discriminated union has no clientEmail/privateKey
        // fields at all — asserting the mode is enough to prove no key material
        // is read or required for this path.
        expect("clientEmail" in result.config).toBe(false);
        expect("privateKey" in result.config).toBe(false);
      }
    });
  });

  describe("AUTH_MODE=service_account — kept as a supported fallback, unchanged", () => {
    it("reports not-ok when CLIENT_EMAIL is missing", () => {
      vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "jeevamitra");
      vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "service_account");
      vi.stubEnv("JEEVAMITRA_FIREBASE_CLIENT_EMAIL", "");
      vi.stubEnv("JEEVAMITRA_FIREBASE_PRIVATE_KEY", "");
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
      const result = loadJeevaMitraConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/CLIENT_EMAIL/);
    });

    it("reports not-ok when PRIVATE_KEY is missing", () => {
      vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "jeevamitra");
      vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "service_account");
      vi.stubEnv("JEEVAMITRA_FIREBASE_CLIENT_EMAIL", "svc@example.iam.gserviceaccount.com");
      vi.stubEnv("JEEVAMITRA_FIREBASE_PRIVATE_KEY", "");
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
      const result = loadJeevaMitraConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/PRIVATE_KEY/);
    });

    it("succeeds with a full credential set and normalizes escaped newlines", () => {
      vi.stubEnv("JEEVAMITRA_FIREBASE_PROJECT_ID", "jeevamitra");
      vi.stubEnv("JEEVAMITRA_FIREBASE_AUTH_MODE", "service_account");
      vi.stubEnv("JEEVAMITRA_FIREBASE_CLIENT_EMAIL", "svc@example.iam.gserviceaccount.com");
      vi.stubEnv("JEEVAMITRA_FIREBASE_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n");
      vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");

      const result = loadJeevaMitraConfig();
      expect(result.ok).toBe(true);
      if (result.ok && result.config.mode === "service_account") {
        expect(result.config.privateKey).toContain("\n");
        expect(result.config.privateKey).not.toContain("\\n");
      } else {
        expect.fail("expected mode 'service_account'");
      }
    });
  });
});
