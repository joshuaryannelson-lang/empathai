// app/api/cases/[id]/ai-summary/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

type SourcedBullet = {
  text: string;
  source: string; // e.g. "[source: check-ins week 3–4]"
};

type AiSummaryPayload = {
  case_id: string;
  week_start: string;
  changes_since_last: SourcedBullet[];
  goal_progress: SourcedBullet[];
  barriers: SourcedBullet[];
  session_focus: SourcedBullet[];
  risk_signals: SourcedBullet[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function extractCaseId(requestUrl: string, paramsMaybe: any): string | null {
  const fromParams = paramsMaybe?.id;
  if (typeof fromParams === "string" && fromParams.length) return fromParams;
  try {
    const u = new URL(requestUrl);
    const m = u.pathname.match(/\/api\/cases\/([^/]+)\/ai-summary/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {}
  return null;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickUnique<T>(rng: () => number, arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length && out.length < n) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

// ── Content pools ────────────────────────────────────────────────────────────

const CHANGES: SourcedBullet[] = [
  { text: "Theme shift detected: sleep disruption → workplace stress", source: "check-ins weeks 3–4" },
  { text: "Check-in scores improved vs prior baseline (+1.4 avg)", source: "weekly check-ins" },
  { text: "Mood variability increased mid-week based on self-report", source: "check-in patterns" },
  { text: "Routine disruption noted (sleep / appetite / structure)", source: "check-in responses" },
  { text: "Engagement is steady but effort level appears higher than usual", source: "engagement signals" },
  { text: "Social support references decreased since prior session", source: "note analysis" },
  { text: "Client mentioned increased work demands for first time this month", source: "session themes" },
];

const GOAL_PROGRESS: SourcedBullet[] = [
  { text: "Goal A (distress tolerance): 40% → 55% — on track", source: "patient check-ins" },
  { text: "Goal B (sleep routine): partial progress, 3 of 5 days logged", source: "habit tracking" },
  { text: "Goal C (social reconnection): stalled — no activity reported this week", source: "check-in responses" },
  { text: "Primary goal engagement rising; client reports noticing the work", source: "weekly check-ins" },
  { text: "Goal pacing is ahead of baseline for this phase of treatment", source: "outcome signals" },
  { text: "Skills practice reported in 2 of 3 check-ins this week", source: "patient check-ins" },
];

const BARRIERS: SourcedBullet[] = [
  { text: "Drop in check-in engagement detected mid-week", source: "missed check-ins" },
  { text: "External stressor (work) may be competing with treatment focus", source: "check-in themes" },
  { text: "Avoidance pattern emerging — shorter, vaguer check-in responses", source: "check-in content" },
  { text: "Sleep disruption likely compounding daytime functioning", source: "check-in signals" },
  { text: "Low follow-through on between-session homework this week", source: "session prep notes" },
  { text: "Social isolation increasing — fewer support network references", source: "check-in analysis" },
];

const SESSION_FOCUS: SourcedBullet[] = [
  { text: "Explore the theme shift (sleep → work stress) and map triggers", source: "check-in pattern" },
  { text: "Review goal progress together; reinforce what is working first", source: "goal tracking" },
  { text: "Introduce one grounding tool for the new stressor context", source: "clinical protocol" },
  { text: "Ask one clarifying question: 'What felt hardest this week?' then reflect back", source: "engagement gap" },
  { text: "Validate recent effort, then agree on one small homework step", source: "progress signals" },
  { text: "Address avoidance pattern before it compounds — keep the session low-stakes", source: "check-in trend" },
];

const RISK_SIGNALS: SourcedBullet[] = [
  { text: "Low-score flag detected (≤ 3) within the check-in window", source: "risk threshold" },
  { text: "No check-ins logged this week — possible disengagement", source: "missing check-ins" },
  { text: "Elevated stressor level reported; monitor next week's trend", source: "check-in scores" },
  { text: "No explicit risk indicators in current signals — monitor routine", source: "weekly check-ins" },
  { text: "Avoidance pattern (short responses, skipped days) warrants attention", source: "check-in analysis" },
  { text: "Score variance high this week — mood instability signal", source: "check-in variance" },
];

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  context: { params?: any }
) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("week_start");
  const caseId = extractCaseId(request.url, context?.params);

  if (!caseId || !weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !isUUID(caseId)) {
    return NextResponse.json(
      { data: null, error: "Missing/invalid caseId or week_start" },
      { status: 400 }
    );
  }

  const seed = hashSeed(`${caseId}-${weekStart}`);
  const rng = mulberry32(seed);
  await sleep(800 + Math.floor(rng() * 700));

  const payload: AiSummaryPayload = {
    case_id: caseId,
    week_start: weekStart,
    changes_since_last: pickUnique(rng, CHANGES, 2),
    goal_progress: pickUnique(rng, GOAL_PROGRESS, 2),
    barriers: pickUnique(rng, BARRIERS, 2),
    session_focus: [pick(rng, SESSION_FOCUS)],
    risk_signals: pickUnique(rng, RISK_SIGNALS, 2),
  };

  return NextResponse.json({ data: payload, error: null });
}
