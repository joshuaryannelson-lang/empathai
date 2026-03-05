// lib/demo/demoMode.ts
// Single source of truth for demo mode detection.
// No other file should check for demo mode directly — always import isDemoMode().

export const DEMO_CONFIG = {
  practiceId: "demo-practice-01",
  therapistId: "demo-therapist-01",
  managerId: "demo-manager-01",
  patientCount: 12,
  caseCount: 12,
  banner: "Demo Environment \u00b7 Synthetic data \u00b7 No real patient info",
} as const;

const LS_KEY = "empathai_demo";

/**
 * Detect demo mode. Checks three sources in order:
 * 1. localStorage key 'empathai_demo' === 'true' (client-side only)
 * 2. URL param ?demo=true
 * 3. Returns false if neither
 *
 * Accepts an optional URL string for server-side route handlers.
 */
export function isDemoMode(urlOrSearch?: string | URLSearchParams): boolean {
  // 1. localStorage (client-side only, SSR-safe)
  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem(LS_KEY) === "true") return true;
    } catch {
      // SSR or blocked storage — fall through
    }
  }

  // 2a. Explicit URL string passed (server-side route handlers)
  if (typeof urlOrSearch === "string") {
    try {
      const u = new URL(urlOrSearch);
      return u.searchParams.get("demo") === "true";
    } catch {
      return false;
    }
  }

  // 2b. URLSearchParams passed directly
  if (urlOrSearch instanceof URLSearchParams) {
    return urlOrSearch.get("demo") === "true";
  }

  // 2c. Client-side: read from window.location
  if (typeof window !== "undefined") {
    try {
      return new URLSearchParams(window.location.search).get("demo") === "true";
    } catch {
      return false;
    }
  }

  return false;
}

/** Activate demo mode via localStorage. */
export function enableDemoMode(): void {
  try {
    localStorage.setItem(LS_KEY, "true");
  } catch {
    // SSR or blocked storage — no-op
  }
}

/** Deactivate demo mode by removing the localStorage key. */
export function disableDemoMode(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // SSR or blocked storage — no-op
  }
}
