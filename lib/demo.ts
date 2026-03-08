// lib/demo.ts
// Exhaustive list of localStorage keys written during demo mode.
// Used by DemoStorageGuard to clean up when leaving demo context.

export const DEMO_STORAGE_KEYS: string[] = [
  // Core demo flag
  "empathai_demo",
  // Persona/selection keys set during demo flows
  "selected_persona",
  "selected_practice_id",
  "selected_therapist_id",
  "selected_manager_mode",
  "user_role",
  // Patient portal demo keys
  "portal_token",
  "portal_case_code",
  "portal_label",
  "patient_case_id",
  "patient_name",
  "patient_id",
];

/**
 * Remove all demo-related localStorage keys.
 * Safe to call in SSR (no-ops if window is unavailable).
 */
export function clearDemoStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of DEMO_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked — no-op
  }
}
