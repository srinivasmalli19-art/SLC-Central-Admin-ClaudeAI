import type { HealthCheckStatus } from "../AppAdapter.js";

// Classifies a raw Firestore/Firebase Admin SDK error into one of the
// generic HealthCheckStatus buckets, and produces a message safe to return
// over the API (never the raw error object, stack trace, or anything that
// could reveal credential details).
//
// Practical note on test coverage (see docs/PHASE-4-PASUMITHRA-INTEGRATION.md
// "Testing"): the Firestore emulator ignores credentials entirely, so it can
// never produce a genuine auth failure — the auth_error branch here is
// exercised by unit tests against synthetic error objects shaped like real
// Firestore/Firebase errors, not against a live Google auth rejection.

const AUTH_ERROR_CODES = new Set([
  7, // gRPC PERMISSION_DENIED
  16, // gRPC UNAUTHENTICATED
  "permission-denied",
  "unauthenticated",
  "app/invalid-credential",
]);

const UNAVAILABLE_CODES = new Set([
  4, // gRPC DEADLINE_EXCEEDED
  14, // gRPC UNAVAILABLE
  "unavailable",
  "deadline-exceeded",
]);

const AUTH_MESSAGE_PATTERNS = [/invalid_grant/i, /invalid.*credential/i, /unauthorized/i, /unauthenticated/i];
const UNAVAILABLE_MESSAGE_PATTERNS = [/unavailable/i, /econnrefused/i, /timeout/i, /timed out/i, /network/i];

interface ClassifiedError {
  status: Exclude<HealthCheckStatus, "healthy">;
  message: string;
}

export function classifyFirestoreError(err: unknown): ClassifiedError {
  const code = (err as { code?: string | number })?.code;
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (code !== undefined && AUTH_ERROR_CODES.has(code)) {
    return { status: "auth_error", message: "Pasumithra rejected the configured credential." };
  }
  if (code !== undefined && UNAVAILABLE_CODES.has(code)) {
    return { status: "unavailable", message: "Pasumithra's Firestore was unreachable." };
  }

  if (AUTH_MESSAGE_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return { status: "auth_error", message: "Pasumithra rejected the configured credential." };
  }
  if (UNAVAILABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return { status: "unavailable", message: "Pasumithra's Firestore was unreachable." };
  }

  // Safe default: an error we can't positively classify is reported as
  // "unavailable", never "healthy".
  return { status: "unavailable", message: "Could not reach Pasumithra's Firestore." };
}
