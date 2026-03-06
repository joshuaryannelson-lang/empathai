// lib/mfaGuard.ts
// Pure-function MFA gate logic for manager accounts.
// Extracted from middleware so it can be unit-tested without Next.js runtime.

export type MfaCheckInput = {
  /** User role from JWT claims (e.g. "manager", "therapist", "patient", "admin") */
  role: string | null;
  /** Authenticator Assurance Level from Supabase session */
  aal: "aal1" | "aal2" | null;
  /** Request path (e.g. "/admin/therapists") */
  path: string;
};

export type MfaCheckResult =
  | { action: "pass" }
  | { action: "redirect"; destination: string };

/**
 * Determine whether a request should be blocked by the MFA gate.
 *
 * Rules:
 * - Only /admin/* routes are gated
 * - Only manager role requires MFA
 * - Therapists, patients, admins are NOT subject to MFA gate
 * - Manager with aal2 passes
 * - Manager with aal1 (or no aal) is redirected to /auth/mfa-enroll
 * - Unauthenticated users on /admin are passed through (admin page handles
 *   its own auth redirect separately)
 */
export function checkMfaGate(input: MfaCheckInput): MfaCheckResult {
  // Only gate /admin routes
  if (!input.path.startsWith("/admin")) {
    return { action: "pass" };
  }

  // No role = unauthenticated — let the page handle its own auth flow
  if (!input.role) {
    return { action: "pass" };
  }

  // Only managers require MFA
  if (input.role !== "manager") {
    return { action: "pass" };
  }

  // Manager with aal2 = MFA verified, allow access
  if (input.aal === "aal2") {
    return { action: "pass" };
  }

  // Manager with aal1 or missing aal = MFA not verified, redirect
  return {
    action: "redirect",
    destination: `/auth/mfa-enroll?next=${encodeURIComponent(input.path)}`,
  };
}
