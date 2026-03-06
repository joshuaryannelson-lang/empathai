// lib/roleContext.ts
// Single source of truth for the active user role.
//
// Phase 1: sessionStorage (empathAI_selected_role)
// Phase 2: Supabase app_metadata.role (planned)
// Phase 3: JWT-only (planned)
//
// The admin role can ONLY come from the JWT — never from sessionStorage.

import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export type Role = "therapist" | "manager" | "admin" | "patient" | null;

const SESSION_KEY = "empathAI_selected_role";

/**
 * Read the active role. Priority:
 *   1. Supabase JWT app_metadata.role (admin ONLY comes from here)
 *   2. sessionStorage empathAI_selected_role
 *   3. null (redirect to role selector)
 */
export function getRole(): Role {
  if (typeof window === "undefined") return null;

  // 1. Check JWT for admin role
  try {
    const sb = getSupabaseBrowser();
    // getSession() is sync when the session is already cached in-memory
    // We do NOT await here — this is a synchronous read of the cached session.
    // On first load the session may not be cached yet; that's fine — sessionStorage
    // or null will be returned, and admin users always have JWT set.
    const sessionData = (sb.auth as unknown as { _session?: { user?: { app_metadata?: { role?: string } } } })?._session;
    const jwtRole = sessionData?.user?.app_metadata?.role as Role | undefined;
    if (jwtRole === "admin") return "admin";
  } catch {
    // no-op — fall through to sessionStorage
  }

  // 2. Check sessionStorage
  try {
    const stored = sessionStorage.getItem(SESSION_KEY) as Role | null;
    if (stored === "therapist" || stored === "manager" || stored === "patient") {
      return stored;
    }
  } catch {
    // no-op
  }

  return null;
}

/**
 * Async version of getRole() that properly awaits the Supabase session.
 * Use this in useEffect or async contexts where you need the JWT role.
 */
export async function getRoleAsync(): Promise<Role> {
  if (typeof window === "undefined") return null;

  // 1. Check JWT
  try {
    const sb = getSupabaseBrowser();
    const { data: { session } } = await sb.auth.getSession();
    const jwtRole = session?.user?.app_metadata?.role as Role | undefined;
    if (jwtRole === "admin") return "admin";
  } catch {
    // no-op
  }

  // 2. Check sessionStorage
  try {
    const stored = sessionStorage.getItem(SESSION_KEY) as Role | null;
    if (stored === "therapist" || stored === "manager" || stored === "patient") {
      return stored;
    }
  } catch {
    // no-op
  }

  return null;
}

/**
 * Set the active role in sessionStorage.
 * "admin" is rejected — admin role must come from JWT.
 */
export function setRole(role: "therapist" | "manager" | "patient"): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, role);
  } catch {
    // no-op
  }
}

/** Clear the stored role (e.g. on logout or "Switch role"). */
export function clearRole(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  // Also clear backward-compat localStorage keys
  try { localStorage.removeItem("user_role"); } catch {}
  try { localStorage.removeItem("selected_persona"); } catch {}
}

/** True only if the JWT contains role = "admin". */
export function isAdmin(): boolean {
  return getRole() === "admin";
}
