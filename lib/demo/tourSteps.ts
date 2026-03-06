// lib/demo/tourSteps.ts
// Shared tour step definitions for the investor demo guided tour.

import { DEMO_CONFIG } from "./demoMode";

export const TOUR_SS_KEY = "empathai_demo_tour";

export type TourStep = {
  step: number;
  role: string;
  icon: string;
  title: string;
  detail: string;
  color: string;
  colorRgb: string;
  href: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    role: "Manager",
    icon: "\u2B21",
    title: "Monday Morning Briefing",
    detail:
      "The practice manager opens their dashboard and instantly sees which therapists need support, which cases are at-risk, and overall practice health.",
    color: "#00c8a0",
    colorRgb: "0,200,160",
    href: `/admin/status?demo=true&practice_id=${DEMO_CONFIG.practiceId}`,
  },
  {
    step: 2,
    role: "Therapist",
    icon: "\u25CE",
    title: "A Case Needs Attention",
    detail:
      "A therapist sees a flagged patient on their caseload \u2014 declining scores and a missed check-in. The system already surfaced it.",
    color: "#7c5cfc",
    colorRgb: "124,92,252",
    href: `/dashboard/therapists/${DEMO_CONFIG.therapistId}/care?demo=true`,
  },
  {
    step: 3,
    role: "AI Engine",
    icon: "\u2726",
    title: "AI Session Prep",
    detail:
      "Before the session, EmpathAI generates structured prep: goal progress, barriers, suggested focus \u2014 all linked to the signals that drove them.",
    color: "#f5a623",
    colorRgb: "245,166,35",
    href: `/cases/demo-case-03?demo=true`,
  },
  {
    step: 4,
    role: "Patient",
    icon: "\u2661",
    title: "Patient Check-In",
    detail:
      "The patient completes their weekly check-in \u2014 rating mood, logging sleep, and flagging a new stressor. It takes under 2 minutes.",
    color: "#38bdf8",
    colorRgb: "56,189,248",
    href: "/portal/checkin?demo=true",
  },
  {
    step: 5,
    role: "Manager",
    icon: "\u2B21",
    title: "Practice Health Score",
    detail:
      "The Therapist Health Score (THS) updates in real time \u2014 showing what moved the needle and which actions to prioritize this week.",
    color: "#00c8a0",
    colorRgb: "0,200,160",
    href: `/practices/${DEMO_CONFIG.practiceId}/health-score?demo=true`,
  },
];
