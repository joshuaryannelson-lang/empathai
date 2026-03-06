// lib/demo/demoData.ts
// Hardcoded synthetic data for demo mode. All names are clearly fictional.
// No Supabase queries — purely in-memory.

import { DEMO_CONFIG } from "./demoMode";

// ── IDs ──────────────────────────────────────────────────────────────────────

const P = DEMO_CONFIG.practiceId;           // "demo-practice-01"
const P2 = "demo-practice-02";
const P3 = "demo-practice-03";
const T1 = DEMO_CONFIG.therapistId;       // "demo-therapist-01"
const T2 = "demo-therapist-02";
const T3 = "demo-therapist-03";

function caseId(n: number) { return `demo-case-${String(n).padStart(2, "0")}`; }
function patientId(n: number) { return `demo-patient-${String(n).padStart(2, "0")}`; }

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86400000).toISOString();
}
function dateAgo(d: number) {
  return new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
}
function dateFuture(d: number) {
  return new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
}

// ── Practice ─────────────────────────────────────────────────────────────────

export const demoPractice = {
  id: P,
  name: "Sunrise Wellness Group",
};

export const demoPractices = [
  { id: P,  name: "Sunrise Wellness Group" },
  { id: P2, name: "Harbor Mind Center" },
  { id: P3, name: "Evergreen Therapy Collective" },
];

// Manager-practice assignments: demo manager is assigned to P and P2 only.
// P3 remains unassigned — verifies RLS scoping in tests.
export const demoManagerAssignments = [
  { id: "demo-mpa-01", manager_id: DEMO_CONFIG.managerId, practice_id: P,  assigned_at: daysAgo(30), assigned_by: "demo-admin-01" },
  { id: "demo-mpa-02", manager_id: DEMO_CONFIG.managerId, practice_id: P2, assigned_at: daysAgo(30), assigned_by: "demo-admin-01" },
];

// ── Therapists ───────────────────────────────────────────────────────────────

export const demoTherapists = [
  { id: T1, name: "Dr. Maya Chen", practice_id: P, extended_profile: { license_type: "LCSW", license_state: "CA", therapy_modalities: ["CBT", "DBT"], specializations: ["Anxiety", "Depression"] } },
  { id: T2, name: "Dr. James Okafor", practice_id: P, extended_profile: { license_type: "PsyD", license_state: "CA", therapy_modalities: ["ACT", "Mindfulness"], specializations: ["Trauma", "PTSD"] } },
  { id: T3, name: "Dr. Priya Sharma", practice_id: P, extended_profile: { license_type: "LMFT", license_state: "CA", therapy_modalities: ["EFT", "Family Systems"], specializations: ["Couples", "Family"] } },
];

// ── Patients ─────────────────────────────────────────────────────────────────

export const demoPatients = [
  { id: patientId(1),  first_name: "Alex",    case_code: "EM-1001" },
  { id: patientId(2),  first_name: "Jordan",  case_code: "EM-1002" },
  { id: patientId(3),  first_name: "Sam",     case_code: "EM-1003" },
  { id: patientId(4),  first_name: "Riley",   case_code: "EM-1004" },
  { id: patientId(5),  first_name: "Morgan",  case_code: "EM-1005" },
  { id: patientId(6),  first_name: "Casey",   case_code: "EM-1006" },
  { id: patientId(7),  first_name: "Taylor",  case_code: "EM-1007" },
  { id: patientId(8),  first_name: "Quinn",   case_code: "EM-1008" },
  { id: patientId(9),  first_name: "Avery",   case_code: "EM-1009" },
  { id: patientId(10), first_name: "Cameron", case_code: "EM-1010" },
  { id: patientId(11), first_name: "Drew",    case_code: "EM-1011" },
  { id: patientId(12), first_name: "Sage",    case_code: "EM-1012" },
];

// ── Cases ────────────────────────────────────────────────────────────────────
// Therapist 1 (Maya): cases 1-4, Therapist 2 (James): cases 5-8, Therapist 3 (Priya): cases 9-12
// Case 3 is the critical case (Alex R. → Sam T. with score 2)

export const demoCases = [
  // Dr. Maya Chen's caseload
  { id: caseId(1),  practice_id: P, therapist_id: T1, patient_id: patientId(1),  title: "Sleep & Stress Management", status: "active", created_at: daysAgo(60) },
  { id: caseId(2),  practice_id: P, therapist_id: T1, patient_id: patientId(2),  title: "Weekly Support", status: "active", created_at: daysAgo(45) },
  { id: caseId(3),  practice_id: P, therapist_id: T1, patient_id: patientId(3),  title: "Urgent Support", status: "active", created_at: daysAgo(30) }, // CRITICAL
  { id: caseId(4),  practice_id: P, therapist_id: T1, patient_id: patientId(4),  title: "Life Transition", status: "active", created_at: daysAgo(55) },
  // Dr. James Okafor's caseload
  { id: caseId(5),  practice_id: P, therapist_id: T2, patient_id: patientId(5),  title: "Relationship & Communication", status: "active", created_at: daysAgo(50) },
  { id: caseId(6),  practice_id: P, therapist_id: T2, patient_id: patientId(6),  title: "Mood & Coping Skills", status: "active", created_at: daysAgo(40) },
  { id: caseId(7),  practice_id: P, therapist_id: T2, patient_id: patientId(7),  title: "Mood Monitoring", status: "active", created_at: daysAgo(35) },
  { id: caseId(8),  practice_id: P, therapist_id: T2, patient_id: patientId(8),  title: "Confidence Building", status: "active", created_at: daysAgo(42) },
  // Dr. Priya Sharma's caseload
  { id: caseId(9),  practice_id: P, therapist_id: T3, patient_id: patientId(9),  title: "Family Dynamics", status: "active", created_at: daysAgo(38) },
  { id: caseId(10), practice_id: P, therapist_id: T3, patient_id: patientId(10), title: "Work-Life Balance", status: "active", created_at: daysAgo(28) },
  { id: caseId(11), practice_id: P, therapist_id: T3, patient_id: patientId(11), title: "Personal Growth", status: "active", created_at: daysAgo(22) },
  { id: caseId(12), practice_id: P, therapist_id: T3, patient_id: patientId(12), title: "Grief Processing", status: "active", created_at: daysAgo(18) },
];

// ── Check-ins ────────────────────────────────────────────────────────────────
// 3-4 per case, varied scores. Case 3 has critical score 2.

export const demoCheckins = [
  // Case 1 — stable (Alex R.)
  { id: "demo-ci-01a", case_id: caseId(1), score: 7, mood: 7, created_at: daysAgo(1),  note: "Feeling pretty good this week, sleep is better." },
  { id: "demo-ci-01b", case_id: caseId(1), score: 6, mood: 6, created_at: daysAgo(8),  note: "Some work stress but managing." },
  { id: "demo-ci-01c", case_id: caseId(1), score: 7, mood: 7, created_at: daysAgo(15), note: "Good week overall." },
  // Case 2 — improving (Jordan M.)
  { id: "demo-ci-02a", case_id: caseId(2), score: 8, mood: 8, created_at: daysAgo(2),  note: "Best week in a while, used the breathing exercises." },
  { id: "demo-ci-02b", case_id: caseId(2), score: 6, mood: 6, created_at: daysAgo(9),  note: "Okay week." },
  { id: "demo-ci-02c", case_id: caseId(2), score: 5, mood: 5, created_at: daysAgo(16), note: "Struggled a bit." },
  { id: "demo-ci-02d", case_id: caseId(2), score: 4, mood: 4, created_at: daysAgo(23), note: "Hard week." },
  // Case 3 — CRITICAL (Sam T.) — declining trajectory ending at 2
  { id: "demo-ci-03a", case_id: caseId(3), score: 2, mood: 2, created_at: daysAgo(1),  note: "Everything feels overwhelming. Can't see the point." },
  { id: "demo-ci-03b", case_id: caseId(3), score: 4, mood: 3, created_at: daysAgo(8),  note: "Not great. Missed my appointment." },
  { id: "demo-ci-03c", case_id: caseId(3), score: 5, mood: 5, created_at: daysAgo(15), note: "Okay but worried about things." },
  { id: "demo-ci-03d", case_id: caseId(3), score: 6, mood: 6, created_at: daysAgo(22), note: "Decent week." },
  // Case 4 — stable (Riley K.)
  { id: "demo-ci-04a", case_id: caseId(4), score: 7, mood: 7, created_at: daysAgo(3),  note: "Things are going well." },
  { id: "demo-ci-04b", case_id: caseId(4), score: 8, mood: 8, created_at: daysAgo(10), note: "Great session last week." },
  { id: "demo-ci-04c", case_id: caseId(4), score: 7, mood: 7, created_at: daysAgo(17), note: null },
  // Case 5 — declining (Morgan L.)
  { id: "demo-ci-05a", case_id: caseId(5), score: 4, mood: 4, created_at: daysAgo(2),  note: "Tough week. Relationship stress." },
  { id: "demo-ci-05b", case_id: caseId(5), score: 5, mood: 5, created_at: daysAgo(9),  note: "Managing but tired." },
  { id: "demo-ci-05c", case_id: caseId(5), score: 7, mood: 6, created_at: daysAgo(16), note: "Better this week." },
  // Case 6 — stable (Casey W.)
  { id: "demo-ci-06a", case_id: caseId(6), score: 8, mood: 8, created_at: daysAgo(1),  note: "Really good week. Started journaling." },
  { id: "demo-ci-06b", case_id: caseId(6), score: 7, mood: 7, created_at: daysAgo(8),  note: "Steady." },
  { id: "demo-ci-06c", case_id: caseId(6), score: 7, mood: 7, created_at: daysAgo(15), note: null },
  // Case 7 — monitor (Taylor B.)
  { id: "demo-ci-07a", case_id: caseId(7), score: 5, mood: 5, created_at: daysAgo(3),  note: "Up and down." },
  { id: "demo-ci-07b", case_id: caseId(7), score: 5, mood: 4, created_at: daysAgo(10), note: "Still adjusting to new medication." },
  { id: "demo-ci-07c", case_id: caseId(7), score: 6, mood: 6, created_at: daysAgo(17), note: "Slowly improving." },
  // Case 8 — stable (Quinn D.)
  { id: "demo-ci-08a", case_id: caseId(8), score: 9, mood: 9, created_at: daysAgo(2),  note: "Excellent week. Completed all homework." },
  { id: "demo-ci-08b", case_id: caseId(8), score: 8, mood: 8, created_at: daysAgo(9),  note: "Doing well." },
  { id: "demo-ci-08c", case_id: caseId(8), score: 8, mood: 8, created_at: daysAgo(16), note: "Consistent." },
  // Case 9 — stable (Avery H.)
  { id: "demo-ci-09a", case_id: caseId(9), score: 7, mood: 7, created_at: daysAgo(1),  note: "Good week with family." },
  { id: "demo-ci-09b", case_id: caseId(9), score: 6, mood: 6, created_at: daysAgo(8),  note: "Minor setback but recovered." },
  { id: "demo-ci-09c", case_id: caseId(9), score: 7, mood: 7, created_at: daysAgo(15), note: null },
  // Case 10 — declining (Cameron F.)
  { id: "demo-ci-10a", case_id: caseId(10), score: 3, mood: 3, created_at: daysAgo(2),  note: "Really struggling. Work is unbearable." },
  { id: "demo-ci-10b", case_id: caseId(10), score: 5, mood: 5, created_at: daysAgo(9),  note: "Slightly better." },
  { id: "demo-ci-10c", case_id: caseId(10), score: 6, mood: 6, created_at: daysAgo(16), note: "Had a good day." },
  // Case 11 — improving (Drew P.)
  { id: "demo-ci-11a", case_id: caseId(11), score: 8, mood: 8, created_at: daysAgo(1),  note: "Breakthrough in session. Feeling hopeful." },
  { id: "demo-ci-11b", case_id: caseId(11), score: 6, mood: 6, created_at: daysAgo(8),  note: "Working on it." },
  { id: "demo-ci-11c", case_id: caseId(11), score: 5, mood: 5, created_at: daysAgo(15), note: "Hard but processing." },
  // Case 12 — stable (Sage N.)
  { id: "demo-ci-12a", case_id: caseId(12), score: 7, mood: 7, created_at: daysAgo(3),  note: "Consistent week. Grateful for progress." },
  { id: "demo-ci-12b", case_id: caseId(12), score: 7, mood: 7, created_at: daysAgo(10), note: "Steady as she goes." },
  { id: "demo-ci-12c", case_id: caseId(12), score: 6, mood: 6, created_at: daysAgo(17), note: null },
];

// ── Goals ────────────────────────────────────────────────────────────────────

export const demoGoals = [
  // Case 1
  { id: "demo-goal-01a", case_id: caseId(1), title: "Practice daily mindfulness for 10 minutes", status: "active", target_date: dateFuture(14), created_at: daysAgo(30) },
  { id: "demo-goal-01b", case_id: caseId(1), title: "Identify three coping strategies for work stress", status: "completed", target_date: dateAgo(5), created_at: daysAgo(45) },
  // Case 2
  { id: "demo-goal-02a", case_id: caseId(2), title: "Use breathing exercises when anxious", status: "active", target_date: dateFuture(7), created_at: daysAgo(20) },
  { id: "demo-goal-02b", case_id: caseId(2), title: "Journal three times per week", status: "active", target_date: dateFuture(21), created_at: daysAgo(25) },
  // Case 3 (critical)
  { id: "demo-goal-03a", case_id: caseId(3), title: "Attend all scheduled sessions", status: "active", target_date: dateFuture(7), created_at: daysAgo(15) },
  { id: "demo-goal-03b", case_id: caseId(3), title: "Develop a safety plan", status: "active", target_date: dateFuture(3), created_at: daysAgo(10) },
  { id: "demo-goal-03c", case_id: caseId(3), title: "Build morning routine", status: "active", target_date: dateFuture(14), created_at: daysAgo(20) },
  // Case 4
  { id: "demo-goal-04a", case_id: caseId(4), title: "Reduce caffeine intake", status: "completed", target_date: dateAgo(3), created_at: daysAgo(30) },
  { id: "demo-goal-04b", case_id: caseId(4), title: "Establish consistent sleep schedule", status: "active", target_date: dateFuture(10), created_at: daysAgo(20) },
  // Case 5
  { id: "demo-goal-05a", case_id: caseId(5), title: "Practice assertive communication", status: "active", target_date: dateFuture(14), created_at: daysAgo(25) },
  { id: "demo-goal-05b", case_id: caseId(5), title: "Set boundaries with partner", status: "active", target_date: dateFuture(7), created_at: daysAgo(18) },
  // Case 6-12: 2 goals each
  { id: "demo-goal-06a", case_id: caseId(6),  title: "Continue journaling habit", status: "active", target_date: dateFuture(14), created_at: daysAgo(15) },
  { id: "demo-goal-06b", case_id: caseId(6),  title: "Complete thought record worksheets", status: "completed", target_date: dateAgo(7), created_at: daysAgo(30) },
  { id: "demo-goal-07a", case_id: caseId(7),  title: "Track mood daily", status: "active", target_date: dateFuture(14), created_at: daysAgo(20) },
  { id: "demo-goal-07b", case_id: caseId(7),  title: "Attend medication follow-up", status: "active", target_date: dateFuture(5), created_at: daysAgo(12) },
  { id: "demo-goal-08a", case_id: caseId(8),  title: "Maintain exercise routine", status: "active", target_date: dateFuture(21), created_at: daysAgo(25) },
  { id: "demo-goal-08b", case_id: caseId(8),  title: "Practice social exposure", status: "completed", target_date: dateAgo(2), created_at: daysAgo(35) },
  { id: "demo-goal-09a", case_id: caseId(9),  title: "Improve communication with family", status: "active", target_date: dateFuture(14), created_at: daysAgo(20) },
  { id: "demo-goal-09b", case_id: caseId(9),  title: "Attend family session", status: "completed", target_date: dateAgo(4), created_at: daysAgo(18) },
  { id: "demo-goal-10a", case_id: caseId(10), title: "Develop workplace coping strategies", status: "active", target_date: dateFuture(7), created_at: daysAgo(15) },
  { id: "demo-goal-10b", case_id: caseId(10), title: "Explore career counseling options", status: "active", target_date: dateFuture(14), created_at: daysAgo(10) },
  { id: "demo-goal-11a", case_id: caseId(11), title: "Practice self-compassion exercises", status: "active", target_date: dateFuture(14), created_at: daysAgo(15) },
  { id: "demo-goal-11b", case_id: caseId(11), title: "Build a support network", status: "active", target_date: dateFuture(21), created_at: daysAgo(20) },
  { id: "demo-goal-12a", case_id: caseId(12), title: "Continue gratitude practice", status: "active", target_date: dateFuture(14), created_at: daysAgo(20) },
  { id: "demo-goal-12b", case_id: caseId(12), title: "Read assigned chapter weekly", status: "completed", target_date: dateAgo(5), created_at: daysAgo(25) },
];

// ── Tasks ────────────────────────────────────────────────────────────────────

export const demoTasks = [
  // Case 3 critical — AI-generated therapist follow-up
  { id: "demo-task-03a", case_id: caseId(3), assigned_to_role: "therapist" as const, assigned_to_id: T1, created_by: "ai" as const, title: "Follow up with patient before next session", description: "Patient's score dropped to 2 — check in via phone or message before the scheduled appointment.", status: "pending" as const, due_date: dateFuture(2), source_checkin_id: "demo-ci-03a", redaction_flags: [], created_at: daysAgo(0), updated_at: daysAgo(0) },
  { id: "demo-task-03b", case_id: caseId(3), assigned_to_role: "patient" as const, assigned_to_id: patientId(3), created_by: "ai" as const, title: "Complete a brief mood check each morning", description: "Rate your mood 1-10 when you wake up. Bring the log to your next session.", status: "pending" as const, due_date: dateFuture(5), source_checkin_id: "demo-ci-03a", redaction_flags: [], created_at: daysAgo(0), updated_at: daysAgo(0) },
  { id: "demo-task-03c", case_id: caseId(3), assigned_to_role: "therapist" as const, assigned_to_id: T1, created_by: "ai" as const, title: "Review and update safety plan", description: "Patient's declining trajectory warrants a safety plan review in the next session.", status: "pending" as const, due_date: dateFuture(3), source_checkin_id: "demo-ci-03a", redaction_flags: [], created_at: daysAgo(0), updated_at: daysAgo(0) },
  // Case 1 — mix of AI and manual
  { id: "demo-task-01a", case_id: caseId(1), assigned_to_role: "patient" as const, assigned_to_id: patientId(1), created_by: "ai" as const, title: "Practice the 4-7-8 breathing technique daily", description: "Inhale for 4, hold for 7, exhale for 8. Do this before bed.", status: "in_progress" as const, due_date: dateFuture(5), source_checkin_id: "demo-ci-01a", redaction_flags: [], created_at: daysAgo(1), updated_at: daysAgo(0) },
  { id: "demo-task-01b", case_id: caseId(1), assigned_to_role: "therapist" as const, assigned_to_id: T1, created_by: "therapist" as const, title: "Send sleep hygiene resources", description: "Patient mentioned sleep improvements — reinforce with handout.", status: "completed" as const, due_date: dateAgo(1), source_checkin_id: null, redaction_flags: [], created_at: daysAgo(3), updated_at: daysAgo(1) },
  // Case 5 — declining
  { id: "demo-task-05a", case_id: caseId(5), assigned_to_role: "therapist" as const, assigned_to_id: T2, created_by: "ai" as const, title: "Explore relationship stressors in next session", description: "Patient mentioned relationship stress as primary concern this week.", status: "pending" as const, due_date: dateFuture(4), source_checkin_id: "demo-ci-05a", redaction_flags: [], created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: "demo-task-05b", case_id: caseId(5), assigned_to_role: "patient" as const, assigned_to_id: patientId(5), created_by: "ai" as const, title: "Write down three things that went well today", description: "Practice positive reframing each evening this week.", status: "pending" as const, due_date: dateFuture(6), source_checkin_id: "demo-ci-05a", redaction_flags: [], created_at: daysAgo(1), updated_at: daysAgo(1) },
  // Case 10 — declining
  { id: "demo-task-10a", case_id: caseId(10), assigned_to_role: "therapist" as const, assigned_to_id: T3, created_by: "ai" as const, title: "Assess workplace burnout risk", description: "Patient scored 3 — explore burnout symptoms and coping options.", status: "pending" as const, due_date: dateFuture(3), source_checkin_id: "demo-ci-10a", redaction_flags: [], created_at: daysAgo(1), updated_at: daysAgo(1) },
  // Case 8 — completed task
  { id: "demo-task-08a", case_id: caseId(8), assigned_to_role: "patient" as const, assigned_to_id: patientId(8), created_by: "therapist" as const, title: "Complete exposure hierarchy worksheet", description: null, status: "completed" as const, due_date: dateAgo(2), source_checkin_id: null, redaction_flags: [], created_at: daysAgo(7), updated_at: daysAgo(2) },
];

// ── Helpers for route handlers ───────────────────────────────────────────────

export function getDemoPatient(id: string) {
  return demoPatients.find(p => p.id === id) ?? null;
}

export function getDemoTherapist(id: string) {
  return demoTherapists.find(t => t.id === id) ?? null;
}

export function getDemoCase(id: string) {
  return demoCases.find(c => c.id === id) ?? null;
}

export function getDemoCaseCheckins(caseId: string) {
  return demoCheckins.filter(c => c.case_id === caseId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getDemoCaseGoals(caseId: string) {
  return demoGoals.filter(g => g.case_id === caseId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getDemoCaseTasks(caseId: string) {
  return demoTasks.filter(t => t.case_id === caseId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getDemoTaskById(id: string) {
  return demoTasks.find(t => t.id === id) ?? null;
}

/** Admin overview payload matching /api/admin/overview */
export function getDemoAdminOverview() {
  const allScores = demoCheckins.map(c => c.score).filter((s): s is number => s !== null);
  const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  // Count distinct cases with at least one at-risk check-in (score ≤ 3)
  const atRiskCases = new Set(demoCheckins.filter(c => c.score !== null && c.score <= 3).map(c => c.case_id));
  const atRisk = atRiskCases.size;

  return {
    range: "7d" as const,
    window: { start: new Date(Date.now() - 7 * 86400000).toISOString(), end: new Date().toISOString() },
    totals: {
      practices: 1,
      therapists: demoTherapists.length,
      active_cases: demoCases.length,
      unassigned_cases: 0,
      checkins: demoCheckins.length,
      avg_score: avg,
      at_risk_checkins: atRisk,
    },
    practices: [{
      id: demoPractice.id,
      name: demoPractice.name,
      therapists: demoTherapists.length,
      active_cases: demoCases.length,
      total_cases: demoCases.length,
      unassigned_cases: 0,
      checkins: demoCheckins.length,
      avg_score: avg,
      at_risk_checkins: atRisk,
    }],
  };
}

/** Practice summary payload matching /api/practices/summary */
export function getDemoPracticeSummary() {
  const allScores = demoCheckins.map(c => c.score).filter((s): s is number => s !== null);
  const avg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const atRiskCases = new Set(demoCheckins.filter(c => c.score !== null && c.score <= 3).map(c => c.case_id));
  const atRisk = atRiskCases.size;

  return [{
    id: demoPractice.id,
    name: demoPractice.name,
    therapists: demoTherapists.length,
    cases: demoCases.length,
    unassigned_cases: 0,
    week_checkins: demoCheckins.length,
    week_avg_score: avg,
    at_risk_checkins: atRisk,
  }];
}

/** THS payload matching /api/practices/[id]/ths */
export function getDemoPracticeTHS(practiceId: string) {
  if (practiceId !== DEMO_CONFIG.practiceId) return null;

  const allScores = demoCheckins.map(c => c.score).filter((s): s is number => s !== null);
  const avgScore = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const atRiskCases = new Set(demoCheckins.filter(c => c.score !== null && c.score <= 3).map(c => c.case_id));
  const atRiskCount = atRiskCases.size;
  const weekStart = new Date().toISOString().slice(0, 10);

  const casesByTherapist: Record<string, number> = {};
  for (const t of demoTherapists) casesByTherapist[t.id] = 0;
  for (const c of demoCases) {
    if (casesByTherapist[c.therapist_id] !== undefined) casesByTherapist[c.therapist_id] += 1;
  }

  return {
    practice_id: practiceId,
    week_start: weekStart,
    score: 6.8,
    band: "Balanced",
    ths_components: { engagement: 2.0, stability: 1.8, workload: 1.5, coverage: 1.5, total: 6.8 },
    trend: { prior_week_start: null, prior_score: 6.5, delta: 0.3, direction: "up" },
    movements: [],
    recommendations: atRiskCount > 0
      ? ["Review declining patients with Dr. Chen and Dr. Sharma", "Update safety plans for at-risk cases"]
      : [],
    drivers: {
      avg_checkin_score: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
      therapists_count: demoTherapists.length,
      cases_count: demoCases.length,
      unassigned_cases_count: 0,
      avg_cases_per_therapist: Math.round((demoCases.length / demoTherapists.length) * 10) / 10,
      workload_spread: 0,
      cases_by_therapist: casesByTherapist,
      at_risk_count: atRiskCount,
      checkin_count: demoCheckins.length,
    },
  };
}

/** At-risk queue payload matching /api/practices/[id]/at-risk */
export function getDemoPracticeAtRisk(practiceId: string) {
  if (practiceId !== DEMO_CONFIG.practiceId) return { practice_id: practiceId, week_start: "", queue: [] };

  const weekStart = new Date().toISOString().slice(0, 10);
  const therapistNames: Record<string, string> = {};
  for (const t of demoTherapists) therapistNames[t.id] = t.name;

  const queue = demoCases
    .map(c => {
      const checkins = getDemoCaseCheckins(c.id);
      const scores = checkins.map(ci => ci.score).filter((s): s is number => s !== null);
      const minScore = scores.length ? Math.min(...scores) : null;
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const hasAtRisk = scores.some(s => s <= 3);
      return {
        case_id: c.id,
        case_title: c.title,
        therapist_id: c.therapist_id,
        therapist_name: therapistNames[c.therapist_id] ?? null,
        week_checkins: checkins.length,
        week_avg_score: avg,
        week_min_score: minScore,
        at_risk_this_week: hasAtRisk,
        last_checkin_at: checkins[0]?.created_at ?? null,
        last_score: checkins[0]?.score ?? null,
      };
    })
    .filter(r => r.at_risk_this_week)
    .sort((a, b) => (a.week_min_score ?? 999) - (b.week_min_score ?? 999));

  return { practice_id: practiceId, week_start: weekStart, queue };
}

/** Case signals payload matching /api/therapists/[id]/case-signals */
export function getDemoCaseSignals(therapistId: string) {
  const weekStart = new Date().toISOString().slice(0, 10);
  const cases = demoCases.filter(c => c.therapist_id === therapistId);

  const caseSignals = cases.map(c => {
    const checkins = getDemoCaseCheckins(c.id);
    const scores = checkins.map(ci => ci.score).filter((s): s is number => s !== null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const hasAtRisk = scores.some(s => s <= 3);
    const missing = checkins.length === 0;

    let signal: "AT_RISK" | "MISSING_CHECKIN" | "MONITOR" | "OK" = "OK";
    if (hasAtRisk) signal = "AT_RISK";
    else if (missing) signal = "MISSING_CHECKIN";
    else if (avg !== null && avg <= 5) signal = "MONITOR";

    return {
      case_id: c.id,
      label: c.id,
      signal,
      last_checkin_at: checkins[0]?.created_at ?? null,
      last_score: checkins[0]?.score ?? null,
      week_checkins: checkins.length,
      week_avg_score: avg,
    };
  });

  const severity: Record<string, number> = { AT_RISK: 0, MISSING_CHECKIN: 1, MONITOR: 2, OK: 3 };
  caseSignals.sort((a, b) => severity[a.signal] - severity[b.signal]);

  return { therapist_id: therapistId, week_start: weekStart, cases: caseSignals };
}

/** Normalized case list matching what /api/cases returns */
export function getDemoNormalizedCases(practiceId?: string, therapistId?: string) {
  let cases = demoCases;
  if (practiceId) cases = cases.filter(c => c.practice_id === practiceId);
  if (therapistId) cases = cases.filter(c => c.therapist_id === therapistId);

  return cases.map(c => {
    const patient = getDemoPatient(c.patient_id);
    const therapist = getDemoTherapist(c.therapist_id);
    const checkins = getDemoCaseCheckins(c.id);
    const latest = checkins[0] ?? null;
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      created_at: c.created_at,
      practice_id: c.practice_id,
      therapist_id: c.therapist_id,
      patient_id: c.patient_id,
      therapist_name: therapist?.name ?? null,
      patient_first_name: patient?.first_name ?? null,
      case_code: patient?.case_code ?? null,
      latest_score: latest?.score ?? null,
      latest_checkin: latest?.created_at ?? null,
    };
  });
}

/** Timeline payload matching /api/cases/[id]/timeline */
export function getDemoTimeline(caseIdVal: string) {
  const c = getDemoCase(caseIdVal);
  if (!c) return null;
  const patient = getDemoPatient(c.patient_id);
  const therapist = getDemoTherapist(c.therapist_id);
  const checkins = getDemoCaseCheckins(caseIdVal);
  return {
    case: { id: c.id, title: c.title, status: c.status, created_at: c.created_at },
    patient: patient ? { first_name: patient.first_name, case_code: patient.case_code, extended_profile: {} } : null,
    therapist: therapist ? { name: therapist.name, extended_profile: therapist.extended_profile } : null,
    checkins: checkins.map(ci => ({ ...ci, notes: ci.note })),
  };
}

/** Care payload matching /api/therapists/[id]/care */
export function getDemoTherapistCare(therapistIdVal: string) {
  const therapist = getDemoTherapist(therapistIdVal);
  const cases = demoCases.filter(c => c.therapist_id === therapistIdVal);
  const weekStart = new Date().toISOString().slice(0, 10);

  const casesTable = cases.map(c => {
    const patient = getDemoPatient(c.patient_id);
    const checkins = getDemoCaseCheckins(c.id);
    const scores = checkins.map(ci => ci.score).filter((s): s is number => s !== null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const low = scores.filter(s => s <= 3).length;
    return {
      case_id: c.id,
      case_title: c.title,
      patient_first_name: patient?.first_name ?? null,
      case_code: patient?.case_code ?? null,
      checkins: checkins.length,
      avg_score: avg,
      lowest_score: scores.length ? Math.min(...scores) : null,
      at_risk_checkins: low,
      missing_checkin: checkins.length === 0,
      last_checkin_at: checkins[0]?.created_at ?? null,
    };
  });

  const allScores = casesTable.flatMap(c => {
    const cis = getDemoCaseCheckins(c.case_id);
    return cis.map(ci => ci.score).filter((s): s is number => s !== null);
  });
  const totalAvg = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const totalLow = allScores.filter(s => s <= 3).length;
  const totalCheckins = casesTable.reduce((s, c) => s + c.checkins, 0);
  const missing = casesTable.filter(c => c.missing_checkin).length;

  return {
    therapist_id: therapistIdVal,
    therapist_name: therapist?.name ?? null,
    week_start: weekStart,
    practice_id: DEMO_CONFIG.practiceId,
    totals: {
      active_cases: cases.length,
      checkins: totalCheckins,
      avg_score: totalAvg,
      at_risk_checkins: totalLow,
      missing_checkins: missing,
    },
    cases: casesTable,
  };
}
