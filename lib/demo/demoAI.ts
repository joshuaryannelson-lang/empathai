// lib/demo/demoAI.ts
// Canned AI responses for demo mode. No real Claude API calls.

import type { GeneratedTask } from "@/lib/services/taskGeneration";
import type { BriefingResult } from "@/lib/services/briefing";
import type { TaskGenerationResult } from "@/lib/services/taskGeneration";

// ── Briefings ────────────────────────────────────────────────────────────────

const THERAPIST_BRIEFING = `This week your caseload shows a critical signal from Sam T., whose score dropped from 5 to 2 with a note about feeling overwhelmed. I'd recommend reaching out before your next scheduled session — a brief phone check-in could make a meaningful difference. On the positive side, Jordan M. is showing strong improvement with scores climbing from 4 to 8, and Alex R. and Riley K. remain stable. Consider reviewing Sam's safety plan at the start of your next session and reinforcing the coping strategies that are working well for Jordan.`;

const MANAGER_BRIEFING = `PRIORITY: Dr. Maya Chen has a critical-risk patient (score 2, declining trajectory) who needs immediate follow-up before the next session.\nAT RISK: Sam T. on Dr. Chen's caseload dropped from 6 to 2 over three weeks — this is the highest-priority signal in the practice. Cameron F. under Dr. Sharma also declined to 3.\nFOLLOW UP: All 12 active cases have current check-ins this week. Engagement is strong across the practice with no missing check-ins.\nTHIS WEEK: Schedule a brief team huddle to review the two declining cases and ensure safety plans are current. The practice THS score of 6.8 is solid — focus on stabilizing the at-risk patients to maintain it.`;

const NETWORK_BRIEFING = `PRIORITY: Sunrise Wellness Group has 2 at-risk patients requiring immediate clinical attention this week.\nUNASSIGNED: No unassigned cases in the current period — all 12 active cases have assigned therapists, which is keeping the Stability component healthy.\nAT RISK: The at-risk signals are concentrated in one practice. Dr. Maya Chen's patient (score 2) and Dr. Priya Sharma's patient (score 3) should be reviewed today. Both show declining multi-week trajectories.\nTHIS WEEK: Focus clinical oversight on Sunrise Wellness Group's two declining cases. The overall network engagement rate is excellent — 100% check-in completion — so the operational priority is clinical intervention, not patient engagement.`;

export function getDemoBriefing(role: "therapist" | "manager" | "network"): BriefingResult {
  const text = role === "therapist" ? THERAPIST_BRIEFING
    : role === "manager" ? MANAGER_BRIEFING
    : NETWORK_BRIEFING;

  return {
    output: text,
    blocked: false,
    redactionFlags: [],
  };
}

// ── Session Prep ─────────────────────────────────────────────────────────────

const SESSION_PREPS: Record<string, string> = {
  "demo-case-03": `OPEN WITH: "I noticed your check-in this week was lower than usual — can you tell me what's been weighing on you the most?"
WATCH FOR: Declining trajectory from 6 to 2 over three weeks suggests increasing distress. Monitor for hopelessness language and missed appointments.
TRY THIS: Collaboratively review the safety plan and identify one small, concrete action the patient can take before the next session.
SEND THIS: Hi Sam, I saw your check-in and wanted you to know I'm here. Let's talk through what's been going on — I'll make sure we have extra time in our next session.`,

  "demo-case-01": `OPEN WITH: "Your sleep seems to be improving — what changes have you noticed in your daily routine?"
WATCH FOR: Consistent 6-7 scores suggest stability but watch for plateau. Patient mentioned work stress as an ongoing trigger.
TRY THIS: Introduce a brief stress-inoculation technique — have the patient rehearse a challenging work scenario and practice their coping response.
SEND THIS: Hi Alex, glad to hear things are trending in the right direction. Looking forward to building on that momentum in our next session.`,

  "demo-case-05": `OPEN WITH: "You mentioned relationship stress this week — would you like to start there, or is there something else on your mind?"
WATCH FOR: Score dropped from 7 to 4 — relationship conflict appears to be the primary driver. Assess whether this is situational or part of a broader pattern.
TRY THIS: Introduce the "soft startup" technique from Gottman research for approaching difficult conversations with a partner.
SEND THIS: Hi Morgan, I appreciated you sharing what's going on. We'll work through some strategies together in our next session.`,
};

const DEFAULT_SESSION_PREP = `OPEN WITH: "How has your week been since we last spoke?"
WATCH FOR: Check-in engagement and note content for any shifts in mood or functioning.
TRY THIS: Review progress on current treatment goals and adjust if needed.
SEND THIS: Looking forward to our session — I'll have your recent check-ins ready so we can track how things are going.`;

export function getDemoSessionPrep(caseId: string): string {
  return SESSION_PREPS[caseId] ?? DEFAULT_SESSION_PREP;
}

/** Structured session prep matching SessionPrepOutput shape */
export type DemoSessionPrepStructured = {
  rating_trend: string;
  rating_delta: number | null;
  notable_themes: string[];
  suggested_focus: string;
  data_source: string;
  confidence: "high" | "medium" | "low";
  flags: string[];
};

const STRUCTURED_SESSION_PREPS: Record<string, DemoSessionPrepStructured> = {
  "demo-case-03": {
    rating_trend: "declining",
    rating_delta: -4,
    notable_themes: ["Overwhelm", "Hopelessness language", "Missed appointment"],
    suggested_focus: "Review safety plan collaboratively. Explore what changed between weeks — patient dropped from 6 to 2 over three check-ins. Validate feelings before problem-solving.",
    data_source: "from last 4 check-ins",
    confidence: "high",
    flags: ["declining_trajectory", "critical_score"],
  },
  "demo-case-01": {
    rating_trend: "stable",
    rating_delta: 0,
    notable_themes: ["Sleep improvement", "Work stress (ongoing)", "Coping skills"],
    suggested_focus: "Reinforce sleep gains. Introduce stress-inoculation for work scenarios — patient is stable and ready for skill-building.",
    data_source: "from last 3 check-ins",
    confidence: "high",
    flags: [],
  },
  "demo-case-05": {
    rating_trend: "declining",
    rating_delta: -3,
    notable_themes: ["Relationship conflict", "Fatigue", "Communication patterns"],
    suggested_focus: "Address relationship stress as primary driver. Consider introducing Gottman soft-startup technique for difficult conversations.",
    data_source: "from last 3 check-ins",
    confidence: "medium",
    flags: ["declining_trajectory"],
  },
};

const DEFAULT_STRUCTURED_PREP: DemoSessionPrepStructured = {
  rating_trend: "stable",
  rating_delta: null,
  notable_themes: ["General progress", "Treatment engagement"],
  suggested_focus: "Review progress on current treatment goals and adjust if needed.",
  data_source: "from recent check-ins",
  confidence: "medium",
  flags: [],
};

export function getDemoSessionPrepStructured(caseId: string): DemoSessionPrepStructured {
  return STRUCTURED_SESSION_PREPS[caseId] ?? DEFAULT_STRUCTURED_PREP;
}

// ── Task Generation ──────────────────────────────────────────────────────────

const CASE_TASKS: Record<string, GeneratedTask[]> = {
  "demo-case-03": [
    { title: "Follow up with patient before next session", description: "Patient's score dropped to 2 — check in via phone or message before the scheduled appointment.", assignedToRole: "therapist", dueDate: futureDate(2), sourceCheckinId: "demo-ci-03a", redactionFlags: [] },
    { title: "Complete a brief mood check each morning", description: "Rate your mood 1-10 when you wake up. Bring the log to your next session.", assignedToRole: "patient", dueDate: futureDate(5), sourceCheckinId: "demo-ci-03a", redactionFlags: [] },
    { title: "Review and update safety plan", description: "Patient's declining trajectory warrants a safety plan review in the next session.", assignedToRole: "therapist", dueDate: futureDate(3), sourceCheckinId: "demo-ci-03a", redactionFlags: [] },
  ],
  "demo-case-05": [
    { title: "Explore relationship stressors in next session", description: "Patient mentioned relationship stress as primary concern this week.", assignedToRole: "therapist", dueDate: futureDate(4), redactionFlags: [] },
    { title: "Write down three things that went well today", description: "Practice positive reframing each evening this week.", assignedToRole: "patient", dueDate: futureDate(6), redactionFlags: [] },
  ],
  "demo-case-10": [
    { title: "Assess workplace burnout risk", description: "Patient scored 3 — explore burnout symptoms and coping options.", assignedToRole: "therapist", dueDate: futureDate(3), redactionFlags: [] },
    { title: "Identify one healthy boundary to set at work", description: "Choose one specific situation where you'll practice saying no this week.", assignedToRole: "patient", dueDate: futureDate(5), redactionFlags: [] },
  ],
};

const DEFAULT_TASKS: GeneratedTask[] = [
  { title: "Review treatment goals with patient", description: "Check progress and adjust goals based on recent check-in data.", assignedToRole: "therapist", dueDate: futureDate(5), redactionFlags: [] },
  { title: "Complete weekly mood journal", description: "Write 2-3 sentences about your week each evening.", assignedToRole: "patient", dueDate: futureDate(6), redactionFlags: [] },
];

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export function getDemoTasks(caseId: string): TaskGenerationResult {
  const tasks = CASE_TASKS[caseId] ?? DEFAULT_TASKS;
  return {
    tasks,
    blocked: false,
    auditId: `demo-audit-${Date.now()}`,
  };
}
