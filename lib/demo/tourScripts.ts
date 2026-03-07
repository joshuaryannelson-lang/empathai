// lib/demo/tourScripts.ts
// Persona-specific guided tour definitions.
// Each tour is an ordered list of steps with page URLs, copy, and optional target selectors.

import { DEMO_CONFIG } from "./demoMode";

export type DemoPersona = "therapist" | "patient" | "manager" | "practice_owner";

export type TourStepDef = {
  page: string;
  headline: string;
  body: string;
  targetSelector?: string; // CSS selector for the element to highlight
};

export type PersonaTour = {
  persona: DemoPersona;
  label: string;
  steps: TourStepDef[];
};

const DEMO_CASE_ID = "demo-case-03"; // Sam T. — at-risk showcase

export const TOUR_SCRIPTS: Record<DemoPersona, PersonaTour> = {
  therapist: {
    persona: "therapist",
    label: "Therapist",
    steps: [
      {
        page: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care`,
        headline: "Your caseload at a glance",
        body: "See all your active cases, risk signals, and check-in status in one view. At-risk patients are surfaced automatically.",
        targetSelector: "[data-tour='caseload-summary']",
      },
      {
        page: "/cases",
        headline: "All your active cases",
        body: "Browse your full case list with status indicators, last check-in dates, and quick access to case details.",
        targetSelector: "[data-tour='case-list']",
      },
      {
        page: `/cases/${DEMO_CASE_ID}`,
        headline: "Case detail",
        body: "Dive into a specific case — see the patient's check-in history, mood trends, and recent notes all in one place.",
        targetSelector: "[data-tour='checkin-summary']",
      },
      {
        page: `/cases/${DEMO_CASE_ID}`,
        headline: "AI session prep",
        body: "Before each session, AI generates structured prep: what to open with, what to watch for, and a suggested technique — all based on real patient data.",
        targetSelector: "[data-tour='session-prep']",
      },
      {
        page: `/cases/${DEMO_CASE_ID}`,
        headline: "Session notes",
        body: "Document session observations and clinical notes. Everything stays connected to the case timeline.",
        targetSelector: "[data-tour='session-notes']",
      },
      {
        page: `/cases/${DEMO_CASE_ID}`,
        headline: "Goals tracker",
        body: "Track treatment goals collaboratively. Patients can see their goals in their portal too.",
        targetSelector: "[data-tour='goals-panel']",
      },
    ],
  },

  patient: {
    persona: "patient",
    label: "Patient",
    steps: [
      {
        page: "/portal/welcome",
        headline: "Welcome to your portal",
        body: "Your personal care hub. Check in weekly, view your history, and track treatment goals — all in one place.",
        targetSelector: "[data-tour='welcome-cta']",
      },
      {
        page: "/portal/checkin",
        headline: "Your weekly check-in",
        body: "A simple form that takes about 60 seconds. No app to download, no personal data stored.",
        targetSelector: "[data-tour='checkin-form']",
      },
      {
        page: "/portal/checkin",
        headline: "How you're feeling",
        body: "Rate how you're feeling from 1 to 10 and add an optional note. Your care team reviews this before your next session.",
        targetSelector: "[data-tour='score-input']",
      },
      {
        page: "/portal/history",
        headline: "Your check-in history",
        body: "See your check-in timeline and mood trends over time. Session notes from your therapist appear here too.",
        targetSelector: "[data-tour='history-list']",
      },
      {
        page: "/portal/goals",
        headline: "Your goals",
        body: "View treatment goals set by your care team. Track what you're working toward and celebrate progress.",
        targetSelector: "[data-tour='goals-list']",
      },
    ],
  },

  manager: {
    persona: "manager",
    label: "Manager",
    steps: [
      {
        page: `/admin/status`,
        headline: "Practice health overview",
        body: "See every practice, every therapist, every risk signal at a glance. The AI briefing highlights what needs attention this week.",
        targetSelector: "[data-tour='status-summary']",
      },
      {
        page: `/admin/status`,
        headline: "Active cases",
        body: "Monitor case counts, check-in completion rates, and average scores across your practice network.",
        targetSelector: "[data-tour='case-metrics']",
      },
      {
        page: `/admin/status`,
        headline: "Alerts and flags",
        body: "At-risk cases and missing check-ins are flagged automatically. No patient falls through the cracks.",
        targetSelector: "[data-tour='alerts-section']",
      },
    ],
  },

  practice_owner: {
    persona: "practice_owner",
    label: "Practice Owner",
    steps: [
      {
        page: "/dashboard/manager",
        headline: "Your practice dashboard",
        body: "See your practice's health at a glance — therapist performance, case distribution, and the AI-generated weekly briefing.",
        targetSelector: "[data-tour='dashboard-header']",
      },
      {
        page: "/dashboard/manager",
        headline: "Caseload summary",
        body: "Monitor active cases, unassigned patients, and average check-in scores across your entire practice.",
        targetSelector: "[data-tour='caseload-metrics']",
      },
      {
        page: "/dashboard/manager",
        headline: "Quick actions",
        body: "Drill into specific practices, filter by therapist, or refresh data — all from one place.",
        targetSelector: "[data-tour='quick-actions']",
      },
    ],
  },
};

// Session storage key for active tour state
export const DEMO_TOUR_KEY = "empathai_demo_tour";

export type DemoTourState = {
  persona: DemoPersona;
  step: number; // 0-indexed
  startedAt: string; // ISO timestamp
};

export function readTourState(): DemoTourState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DEMO_TOUR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoTourState;
  } catch {
    return null;
  }
}

export function writeTourState(state: DemoTourState): void {
  try {
    sessionStorage.setItem(DEMO_TOUR_KEY, JSON.stringify(state));
  } catch {}
}

export function clearTourState(): void {
  try {
    sessionStorage.removeItem(DEMO_TOUR_KEY);
  } catch {}
}
