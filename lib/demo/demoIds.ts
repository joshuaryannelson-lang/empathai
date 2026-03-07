// Maps demo slug IDs (used in /login routing) to real Supabase UUIDs.
// Used by API routes that receive URL params which may be demo slugs.

const DEMO_THERAPIST_MAP: Record<string, string> = {
  "demo-therapist-01": "75206ac7-1f12-4e2c-a446-e14593892197",
};

/** Resolve a therapist ID that may be a demo slug to its real UUID. */
export function resolveDemoTherapistId(id: string): string {
  return DEMO_THERAPIST_MAP[id] ?? id;
}
