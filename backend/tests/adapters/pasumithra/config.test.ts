import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPasumithraConfig } from "../../../src/integrations/adapters/pasumithra/config.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadPasumithraConfig", () => {
  it("reports not-ok when PASUMITHRA_FIREBASE_PROJECT_ID is missing", () => {
    vi.stubEnv("PASUMITHRA_FIREBASE_PROJECT_ID", "");
    const result = loadPasumithraConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/PROJECT_ID/);
  });

  it("reports not-ok when CLIENT_EMAIL is missing (non-emulator mode)", () => {
    vi.stubEnv("PASUMITHRA_FIREBASE_PROJECT_ID", "pasumithra-adc10");
    vi.stubEnv("PASUMITHRA_FIREBASE_CLIENT_EMAIL", "");
    vi.stubEnv("PASUMITHRA_FIREBASE_PRIVATE_KEY", "");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
    const result = loadPasumithraConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/CLIENT_EMAIL/);
  });

  it("reports not-ok when PRIVATE_KEY is missing (non-emulator mode)", () => {
    vi.stubEnv("PASUMITHRA_FIREBASE_PROJECT_ID", "pasumithra-adc10");
    vi.stubEnv("PASUMITHRA_FIREBASE_CLIENT_EMAIL", "svc@example.iam.gserviceaccount.com");
    vi.stubEnv("PASUMITHRA_FIREBASE_PRIVATE_KEY", "");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
    const result = loadPasumithraConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/PRIVATE_KEY/);
  });

  it("succeeds with a full credential set and normalizes escaped newlines", () => {
    vi.stubEnv("PASUMITHRA_FIREBASE_PROJECT_ID", "pasumithra-adc10");
    vi.stubEnv("PASUMITHRA_FIREBASE_CLIENT_EMAIL", "svc@example.iam.gserviceaccount.com");
    vi.stubEnv("PASUMITHRA_FIREBASE_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");

    const result = loadPasumithraConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.usingEmulator).toBe(false);
      expect(result.config.privateKey).toContain("\n");
      expect(result.config.privateKey).not.toContain("\\n");
    }
  });

  it("succeeds with only a project id when the Firestore emulator is configured", () => {
    vi.stubEnv("PASUMITHRA_FIREBASE_PROJECT_ID", "demo-pasumithra-adc10");
    vi.stubEnv("PASUMITHRA_FIREBASE_CLIENT_EMAIL", "");
    vi.stubEnv("PASUMITHRA_FIREBASE_PRIVATE_KEY", "");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8090");

    const result = loadPasumithraConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.usingEmulator).toBe(true);
      expect(result.config.clientEmail).toBeUndefined();
    }
  });
});
