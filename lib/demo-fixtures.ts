// ⚠️ DEMO DATA ONLY — never seed to production DB
// lib/demo-fixtures.ts
// Single source of truth for all demo display strings.
// Components should import from here, not hardcode demo names.

export const DEMO_PRACTICE = {
  id: "demo-practice-01",
  name: "Sunrise Wellness Group",
} as const;

export const DEMO_PRACTICES = [
  { id: "demo-practice-01", name: "Sunrise Wellness Group" },
  { id: "demo-practice-02", name: "Harbor Mind Center" },
  { id: "demo-practice-03", name: "Evergreen Therapy Collective" },
] as const;

export const DEMO_THERAPISTS = [
  { id: "demo-therapist-01", name: "Dr. Maya Chen" },
  { id: "demo-therapist-02", name: "Dr. James Okafor" },
  { id: "demo-therapist-03", name: "Dr. Priya Sharma" },
] as const;

export const DEMO_PATIENTS = [
  { id: "demo-patient-01", firstName: "Alex" },
  { id: "demo-patient-02", firstName: "Jordan" },
  { id: "demo-patient-03", firstName: "Sam" },
  { id: "demo-patient-04", firstName: "Riley" },
  { id: "demo-patient-05", firstName: "Morgan" },
  { id: "demo-patient-06", firstName: "Casey" },
  { id: "demo-patient-07", firstName: "Taylor" },
  { id: "demo-patient-08", firstName: "Quinn" },
  { id: "demo-patient-09", firstName: "Avery" },
  { id: "demo-patient-10", firstName: "Cameron" },
  { id: "demo-patient-11", firstName: "Drew" },
  { id: "demo-patient-12", firstName: "Sage" },
] as const;

/** Helper to look up a demo therapist name by ID */
export function getDemoTherapistName(id: string): string {
  return DEMO_THERAPISTS.find((t) => t.id === id)?.name ?? "Demo Therapist";
}
