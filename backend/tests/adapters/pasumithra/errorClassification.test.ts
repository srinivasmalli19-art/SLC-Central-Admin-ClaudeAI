import { describe, expect, it } from "vitest";
import { classifyFirestoreError } from "../../../src/integrations/adapters/pasumithra/errorClassification.js";

// The Firestore emulator ignores credentials entirely, so it can never
// produce a genuine Google auth rejection — see
// docs/PASUMITHRA-ADAPTER.md "Testing". These synthetic error objects are
// shaped exactly like real Firestore/Firebase Admin SDK errors (grpc status
// codes and Firebase's own string codes), so the classifier is exercised
// against realistic shapes even though no live credential was ever rejected.

describe("classifyFirestoreError", () => {
  it("classifies a gRPC PERMISSION_DENIED code as auth_error", () => {
    const result = classifyFirestoreError({ code: 7, message: "7 PERMISSION_DENIED: Missing or insufficient permissions." });
    expect(result.status).toBe("auth_error");
  });

  it("classifies a gRPC UNAUTHENTICATED code as auth_error", () => {
    const result = classifyFirestoreError({ code: 16, message: "16 UNAUTHENTICATED: Request had invalid credentials." });
    expect(result.status).toBe("auth_error");
  });

  it("classifies Firebase's own invalid-credential app error code as auth_error", () => {
    const result = classifyFirestoreError({ code: "app/invalid-credential", message: "Failed to parse private key." });
    expect(result.status).toBe("auth_error");
  });

  it("classifies an invalid_grant message (expired/revoked service account key) as auth_error", () => {
    const result = classifyFirestoreError(new Error("invalid_grant: Invalid JWT Signature."));
    expect(result.status).toBe("auth_error");
  });

  it("classifies a gRPC UNAVAILABLE code as unavailable", () => {
    const result = classifyFirestoreError({ code: 14, message: "14 UNAVAILABLE: No connection established" });
    expect(result.status).toBe("unavailable");
  });

  it("classifies ECONNREFUSED as unavailable", () => {
    const result = classifyFirestoreError(new Error("connect ECONNREFUSED 127.0.0.1:9999"));
    expect(result.status).toBe("unavailable");
  });

  it("defaults an unrecognized error to unavailable, never healthy", () => {
    const result = classifyFirestoreError(new Error("something totally unexpected happened"));
    expect(result.status).toBe("unavailable");
  });

  it("never returns a message containing the raw error object shape", () => {
    const result = classifyFirestoreError({ code: 7, message: "secret-looking-internal-detail" });
    expect(result.message).not.toContain("secret-looking-internal-detail");
  });
});
