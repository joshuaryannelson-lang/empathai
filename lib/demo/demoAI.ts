// lib/demo/demoAI.ts
// Canned AI responses for demo mode. No real Claude API calls.

import type { BriefingResult } from "@/lib/services/briefing";
import type { SessionPrepOutput } from "@/lib/ai/sessionPrepPrompt";

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

// ── Session Prep (4-card structured format) ──────────────────────────────────

const STRUCTURED_SESSION_PREPS: Record<string, SessionPrepOutput> = {
  "demo-case-03": {
    rating_trend: "declining",
    rating_delta: -4,
    data_source: "from last 4 check-ins",
    confidence: "high",
    flags: ["declining_trajectory", "critical_score"],
    open_with: "I noticed your check-in score dropped quite a bit this week \u2014 can you tell me what\u2019s been weighing on you the most, and when you first started feeling that shift?",
    watch_for: "Declining trajectory from 6 to 2 over three weeks with language suggesting overwhelm and hopelessness. Monitor for withdrawal patterns and whether Sam is still engaging with daily routines.",
    try_this: "Collaboratively review the safety plan using a structured check-in: walk through each coping step together, identify which ones Sam has used this week, and agree on one small concrete action to try before the next session.",
    send_this: "Hi Sam, I saw your check-in and wanted you to know I\u2019m thinking of you. We\u2019ll make sure to take things at your pace in our next session \u2014 no pressure, just space to talk through what\u2019s been going on.",
  },
  "demo-case-01": {
    rating_trend: "stable",
    rating_delta: 0,
    data_source: "from last 3 check-ins",
    confidence: "high",
    flags: [],
    open_with: "Your sleep scores have been holding steady \u2014 what\u2019s one change in your wind-down routine that you think is making the biggest difference?",
    watch_for: "Consistent 6\u20137 scores suggest stability but watch for plateau. Alex mentioned work stress as an ongoing trigger in two of the last three check-ins \u2014 assess whether this is manageable or starting to erode gains.",
    try_this: "Introduce a stress-inoculation rehearsal: have Alex walk through a specific upcoming stressful work scenario and practice their coping response (deep breathing + cognitive reframe) in session before it happens.",
    send_this: "Hi Alex, glad to see things trending in the right direction with your sleep. Looking forward to building on that momentum together \u2014 see you Thursday!",
  },
  "demo-case-05": {
    rating_trend: "declining",
    rating_delta: -3,
    data_source: "from last 3 check-ins",
    confidence: "medium",
    flags: ["declining_trajectory"],
    open_with: "You mentioned relationship stress in your last check-in \u2014 would you like to start there today, or is there something else that feels more pressing right now?",
    watch_for: "Score dropped from 7 to 4 with relationship conflict as the primary driver. Assess whether this is a situational stressor or part of a broader communication pattern that\u2019s been building over time.",
    try_this: "Introduce the Gottman \u201Csoft-startup\u201D technique: help Morgan practice opening a difficult conversation with their partner using \u201CI feel\u201D statements instead of criticism, and role-play one specific scenario from this week.",
    send_this: "Hi Morgan, I really appreciated you being open about what\u2019s been going on. We\u2019ll work through some practical strategies together in our next session \u2014 you don\u2019t have to figure this out alone.",
  },
};

const DEFAULT_STRUCTURED_PREP: SessionPrepOutput = {
  rating_trend: "stable",
  rating_delta: null,
  data_source: "from recent check-ins",
  confidence: "medium",
  flags: [],
  open_with: "Based on your recent check-ins, it looks like things have been relatively steady \u2014 what\u2019s felt most manageable this week, and where have you noticed the most effort?",
  watch_for: "Overall stability in scores with no major red flags. Monitor engagement level and whether the patient is actively working on goals or coasting.",
  try_this: "Review progress on current goals using a structured scaling question: \u201COn a scale of 1\u201310, how close are you to where you want to be on this goal?\u201D Then explore what would move it up by one point.",
  send_this: "Looking forward to our session \u2014 I\u2019ll have your recent check-ins ready so we can see how things are tracking together.",
};

export function getDemoSessionPrepStructured(caseId: string): SessionPrepOutput {
  return STRUCTURED_SESSION_PREPS[caseId] ?? DEFAULT_STRUCTURED_PREP;
}
