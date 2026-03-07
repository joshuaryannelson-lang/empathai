// lib/mfaGuard.ts
// Role-based access gate + MFA enforcement for /admin routes.
// Extracted from middleware so it can be unit-tested without Next.js runtime.
//
// Future: /settings/therapist route planned for therapist
// profile and preference management — not yet built

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
 * Role access rules for /admin/*:
 *   admin     → full access to all /admin/* routes (including /admin/dev)
 *   manager   → /admin/* access with MFA required. /admin/dev → redirect to /admin/status.
 *   therapist → zero /admin/* access → redirect to /
 *   patient   → zero /admin/* access → redirect to /
 *   null      → zero /admin/* access → redirect to / (no role = no admin access)
 *
 * MFA rules (manager only):
 *   aal2 → pass
 *   aal1 or null → redirect to /auth/mfa-enroll
 */
export function checkMfaGate(input: MfaCheckInput): MfaCheckResult {
  // Only gate /admin routes
  if (!input.path.startsWith("/admin")) {
    return { action: "pass" };
  }

  // ── Allowed roles: admin and manager only ──
  // Everyone else (therapist, patient, null/unauthenticated) is blocked.
  if (input.role !== "admin" && input.role !== "manager") {
    return { action: "redirect", destination: "/" };
  }

  // ── Admin: full access to everything including /admin/dev ──
  if (input.role === "admin") {
    return { action: "pass" };
  }

  // ── Manager sub-route gates ──

  // /admin/dev: admin only — managers redirected to /admin/status
  if (input.path.startsWith("/admin/dev")) {
    return { action: "redirect", destination: "/admin/status" };
  }

  // ── MFA gate for managers ──

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
