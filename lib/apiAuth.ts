// lib/apiAuth.ts
// Server-side auth guard for API routes.
// Reads the role from cookie + verifies Supabase session when available.
// PHI guardrail: only logs user_id and role, never patient data.

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { bad } from "@/lib/route-helpers";

export type AuthResult = {
  user_id: string | null;
  role: string | null;
  authenticated: boolean;
};

const VALID_ROLES = ["admin", "therapist", "manager", "patient"];

/**
 * Extract auth info from cookies + Supabase session.
 * Returns user_id, role, and whether the user is authenticated.
 */
export async function getApiAuth(): Promise<AuthResult> {
  const cookieStore = await cookies();

  // Try Supabase session first (real auth)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          setAll(_cookies) {
            // Route handlers can't set cookies on the response this way;
            // we only need to read for auth verification.
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const role =
        session.user.app_metadata?.role ??
        session.user.user_metadata?.role ??
        null;
      return {
        user_id: session.user.id,
        role: typeof role === "string" && VALID_ROLES.includes(role) ? role : null,
        authenticated: true,
      };
    }
  } catch {
    // Supabase session check failed — fall through to cookie
  }

  // Fallback: empathAI_role cookie (demo mode / non-Supabase auth)
  const cookieRole = cookieStore.get("empathAI_role")?.value ?? null;
  if (cookieRole && VALID_ROLES.includes(cookieRole)) {
    return {
      user_id: null,
      role: cookieRole,
      authenticated: true,
    };
  }

  return { user_id: null, role: null, authenticated: false };
}

/**
 * Require authentication. Returns 401 if not authenticated.
 */
export async function requireAuth(): Promise<AuthResult | Response> {
  const auth = await getApiAuth();
  if (!auth.authenticated) {
    return bad("Authentication required", 401);
  }
  return auth;
}

/**
 * Require a specific role. Returns 401/403 as appropriate.
 */
export async function requireRole(
  ...allowedRoles: string[]
): Promise<AuthResult | Response> {
  const auth = await getApiAuth();
  if (!auth.authenticated) {
    return bad("Authentication required", 401);
  }
  if (!auth.role || !allowedRoles.includes(auth.role)) {
    return bad("Forbidden", 403);
  }
  return auth;
}

/**
 * Check if the result is an auth error response (vs. a valid AuthResult).
 */
export function isAuthError(result: AuthResult | Response): result is Response {
  return result instanceof Response;
}

/**
 * Log unauthorized API access attempt to portal_audit_log.
 * PHI guardrail: only logs user_id and role, never patient data.
 */
export async function logUnauthorizedAccess(
  route: string,
  attemptedRole: string | null,
  ip: string | null,
): Promise<void> {
  try {
    await supabaseAdmin.from("portal_audit_log").insert({
      event: "unauthorized_api_access",
      case_code: null,
      metadata: {
        route,
        attempted_role: attemptedRole,
        ip: ip ?? "unknown",
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Non-critical — don't fail the request
  }
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * Verify case ownership: the authenticated therapist_id must match
 * the case's therapist_id. Admin role bypasses ownership check.
 */
export async function verifyCaseOwnership(
  caseId: string,
  auth: AuthResult,
): Promise<Response | null> {
  // Admin bypasses ownership check
  if (auth.role === "admin") return null;

  if (auth.role !== "therapist") {
    return bad("Only therapists and admins can modify cases", 403);
  }

  // Look up which therapist record belongs to this user
  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("user_id", auth.user_id)
    .single();

  if (!therapist) {
    return bad("No therapist profile found for this user", 403);
  }

  // Check the case's therapist_id matches
  const { data: caseData } = await supabaseAdmin
    .from("cases")
    .select("therapist_id")
    .eq("id", caseId)
    .single();

  if (!caseData) {
    return bad("Case not found", 404);
  }

  if (caseData.therapist_id !== therapist.id) {
    return bad("You are not assigned to this case", 403);
  }

  return null; // ownership verified
}
