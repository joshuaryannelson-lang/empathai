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

export const TOUR_SCRIPTS: Record<DemoPersona, PersonaTour> = {
  // ── MANAGER TOUR (3 steps) ──────────────────────────────────
  manager: {
    persona: "manager",
    label: "Manager",
    steps: [
      {
        page: "/dashboard/manager?demo=true&step=1",
        headline: "Your practice dashboard",
        body: "Your practice dashboard — therapist performance, case distribution, and the AI-generated weekly briefing at a glance.",
        targetSelector: "[data-demo-spotlight='manager-kpi-row']",
      },
      {
        page: "/dashboard/manager?demo=true&step=2",
        headline: "Routing friction",
        body: "Routing friction surfaces unassigned cases before the week's sessions start — no patient falls through the cracks.",
        targetSelector: "[data-demo-spotlight='routing-friction']",
      },
      {
        page: "/dashboard/manager?demo=true&step=3",
        headline: "Risk signals",
        body: "Risk signals flag check-ins ≤ 3 this week. You see the problem before your therapists do.",
        targetSelector: "[data-demo-spotlight='risk-signals']",
      },
    ],
  },

  // ── THERAPIST TOUR (6 steps) ────────────────────────────────
  therapist: {
    persona: "therapist",
    label: "Therapist",
    steps: [
      {
        page: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care?demo=true&step=1`,
        headline: "Your caseload at a glance",
        body: "Your caseload at a glance — active cases, risk signals, and check-in status updated in real time.",
        targetSelector: "[data-demo-spotlight='therapist-stats']",
      },
      {
        page: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care?demo=true&step=2`,
        headline: "At-risk patients",
        body: "At-risk patients are surfaced automatically — score ≤ 3 triggers an alert here before your next session.",
        targetSelector: "[data-demo-spotlight='at-risk-section']",
      },
      {
        page: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care?demo=true&step=3`,
        headline: "AI briefing",
        body: "Your AI briefing synthesizes every patient's week and flags who needs your attention — generated fresh each Monday.",
        targetSelector: "[data-demo-spotlight='ai-briefing-panel']",
      },
      {
        page: "/cases?demo=true&step=4",
        headline: "All your cases",
        body: "All your cases in one place — filter by risk level, score trend, or missing check-ins.",
        targetSelector: "[data-demo-spotlight='case-list']",
      },
      {
        page: "/cases/demo-case-01?demo=true&step=5",
        headline: "AI session prep",
        body: "AI session prep synthesizes recent check-ins, mood trends, and goals — so you walk in prepared every time.",
        targetSelector: "[data-demo-spotlight='session-prep']",
      },
      {
        page: "/cases/demo-case-01?demo=true&step=6",
        headline: "Clinical notes",
        body: "Review and approve AI output before it becomes part of the session record. You stay in control.",
        targetSelector: "[data-demo-spotlight='clinical-notes']",
      },
    ],
  },

  // ── PATIENT TOUR (5 steps) ──────────────────────────────────
  patient: {
    persona: "patient",
    label: "Patient",
    steps: [
      {
        page: "/portal/welcome?demo=true&step=1",
        headline: "Your secure portal",
        body: "Your secure portal — private, simple, and built around how you actually feel.",
        targetSelector: "[data-demo-spotlight='portal-welcome']",
      },
      {
        page: "/portal/checkin?demo=true&step=2",
        headline: "Weekly check-in",
        body: "Weekly check-in takes 2 minutes. Your therapist sees your mood and notes before your next session.",
        targetSelector: "[data-demo-spotlight='checkin-form']",
      },
      {
        page: "/portal/checkin?demo=true&step=3",
        headline: "Safety support",
        body: "If you mention feeling unsafe, support resources appear immediately and your therapist is alerted.",
        targetSelector: "[data-demo-spotlight='checkin-submit']",
      },
      {
        page: "/portal/history?demo=true&step=4",
        headline: "Your check-in history",
        body: "Your check-in history — mood trends over time and session notes from your therapist.",
        targetSelector: "[data-demo-spotlight='checkin-history']",
      },
      {
        page: "/portal/goals?demo=true&step=5",
        headline: "Your goals",
        body: "Treatment goals set by your care team — track progress and celebrate what's working.",
        targetSelector: "[data-demo-spotlight='goals-list']",
      },
    ],
  },

  // ── PRACTICE OWNER TOUR (3 steps) ───────────────────────────
  practice_owner: {
    persona: "practice_owner",
    label: "Practice Owner",
    steps: [
      {
        page: "/dashboard/manager?demo=true&role=owner&step=1",
        headline: "Your organization",
        body: "Your organization — all practices, all therapists, all risk signals in one view. Built for group practices and health systems.",
        targetSelector: "[data-demo-spotlight='manager-kpi-row']",
      },
      {
        page: "/dashboard/manager?demo=true&role=owner&step=2",
        headline: "Network routing friction",
        body: "See routing friction across every practice in your network — not just one location.",
        targetSelector: "[data-demo-spotlight='routing-friction']",
      },
      {
        page: "/dashboard/manager?demo=true&role=owner&step=3",
        headline: "Network-wide risk signals",
        body: "Network-wide risk signals. When a patient is in crisis, it surfaces here — regardless of which practice they're in.",
        targetSelector: "[data-demo-spotlight='risk-signals']",
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
