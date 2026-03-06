// lib/fixtures/patientDemoData.ts
// Patient-facing demo data gated on NEXT_PUBLIC_DEMO_MODE.
// Provides canned identity, check-ins, goals, and session notes
// without exposing admin-level data structures.

import { demoPatients, demoCases, demoCheckins, demoGoals, demoTherapists } from "@/lib/demo/demoData";

export const PATIENT_DEMO_ENABLED =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    : false;

// Pick demo-case-03 (Sam T.) as the default patient portal demo case
const DEFAULT_DEMO_CASE_ID = "demo-case-03";

export type PatientIdentity = {
  patient_id: string;
  patient_name: string;
  case_id: string;
};

export type PatientCheckin = {
  id: string;
  score: number | null;
  mood: number | null;
  created_at: string;
  note: string | null;
};

export type PatientGoal = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
};

export type PatientSessionNote = { date: string; text: string };

/** Get a demo patient identity for the portal */
export function getDemoPatientIdentity(caseId?: string): PatientIdentity | null {
  const c = demoCases.find(dc => dc.id === (caseId ?? DEFAULT_DEMO_CASE_ID));
  if (!c) return null;
  const p = demoPatients.find(dp => dp.id === c.patient_id);
  if (!p) return null;
  return {
    patient_id: p.id,
    patient_name: `${p.first_name} ${p.last_name}`,
    case_id: c.id,
  };
}

/** Get demo check-ins for a case, sorted newest first */
export function getDemoPatientCheckins(caseId: string): PatientCheckin[] {
  return demoCheckins
    .filter(ci => ci.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(ci => ({
      id: ci.id,
      score: ci.score,
      mood: ci.mood,
      created_at: ci.created_at,
      note: ci.note,
    }));
}

/** Get demo goals for a case */
export function getDemoPatientGoals(caseId: string): PatientGoal[] {
  return demoGoals
    .filter(g => g.case_id === caseId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(g => ({
      id: g.id,
      title: g.title,
      status: g.status,
      target_date: g.target_date,
    }));
}

/** Get therapist name for a case (no other PII exposed) */
export function getDemoTherapistName(caseId: string): string | null {
  const c = demoCases.find(dc => dc.id === caseId);
  if (!c) return null;
  const t = demoTherapists.find(dt => dt.id === c.therapist_id);
  return t?.name ?? null;
}

/** Demo session notes (synthetic, not from real data) */
export function getDemoSessionNotes(): PatientSessionNote[] {
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  return [
    { date: daysAgo(3), text: "Discussed coping strategies for overwhelming feelings. Reviewed safety plan. Patient agreed to call 988 if feeling unsafe." },
    { date: daysAgo(10), text: "Explored work stressors and their impact on mood. Introduced thought-challenging worksheet." },
    { date: daysAgo(17), text: "Initial session. Built rapport and discussed treatment goals. Patient expressed motivation to improve sleep and manage anxiety." },
  ];
}
