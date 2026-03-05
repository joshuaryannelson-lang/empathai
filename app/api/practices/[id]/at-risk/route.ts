// app/api/practices/[id]/at-risk/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function addDaysISO(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

type CaseRow = {
  id: string;
  title: string;
  practice_id: string;
  therapist_id: string | null;
};

type TherapistRow = {
  id: string;
  name: string;
  practice_id: string;
};

type CheckinRow = {
  case_id: string;
  score: number | null;
  created_at: string;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: practiceId } = await context.params;

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("week_start");

  if (!practiceId || !weekStart) {
    return NextResponse.json({ data: null, error: "Missing practiceId or week_start" }, { status: 400 });
  }

  const weekEndISO = addDaysISO(weekStart, 7);

  // 1) Pull cases for this practice
  const { data: casesRaw, error: casesErr } = await supabase
    .from("cases")
    .select("id, title, practice_id, therapist_id")
    .eq("practice_id", practiceId);

  if (casesErr) return NextResponse.json({ data: null, error: casesErr }, { status: 500 });

  const cases = (casesRaw ?? []) as CaseRow[];
  const caseIds = cases.map((c) => c.id);

  if (!caseIds.length) {
    return NextResponse.json({ data: { practice_id: practiceId, week_start: weekStart, queue: [] }, error: null });
  }

  // 2) Pull therapists for this practice (to show names)
  const { data: therapistsRaw, error: thErr } = await supabase
    .from("therapists")
    .select("id, name, practice_id")
    .eq("practice_id", practiceId);

  if (thErr) return NextResponse.json({ data: null, error: thErr }, { status: 500 });

  const therapists = (therapistsRaw ?? []) as TherapistRow[];
  const therapistNameById: Record<string, string> = {};
  for (const t of therapists) therapistNameById[t.id] = t.name;

  // 3) Pull check-ins for the selected week
  const { data: weekCheckinsRaw, error: wkErr } = await supabase
    .from("checkins")
    .select("case_id, score, created_at")
    .in("case_id", caseIds)
    .gte("created_at", weekStart)
    .lt("created_at", weekEndISO);

  if (wkErr) return NextResponse.json({ data: null, error: wkErr }, { status: 500 });

  const weekCheckins = (weekCheckinsRaw ?? []) as CheckinRow[];

  // 4) Pull recent check-ins overall so we can display "last check-in" even if it's not in this week
  // (Optional but makes UI feel real)
  const { data: recentRaw, error: recentErr } = await supabase
    .from("checkins")
    .select("case_id, score, created_at")
    .in("case_id", caseIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (recentErr) return NextResponse.json({ data: null, error: recentErr }, { status: 500 });

  const recent = (recentRaw ?? []) as CheckinRow[];

  // Index: week checkins by case
  const weekByCase: Record<string, CheckinRow[]> = {};
  for (const ci of weekCheckins) {
    (weekByCase[ci.case_id] ||= []).push(ci);
  }

  // Index: last checkin by case (from recent list sorted desc)
  const lastByCase: Record<string, CheckinRow> = {};
  for (const ci of recent) {
    if (!lastByCase[ci.case_id]) lastByCase[ci.case_id] = ci;
  }

  // Define at-risk = any check-in score <= 3 during the selected week
  const queue = cases
    .map((c) => {
      const w = weekByCase[c.id] ?? [];
      const last = lastByCase[c.id] ?? null;

      const weekScores = w.map((x) => x.score).filter((s): s is number => typeof s === "number");
      const weekAvg = weekScores.length ? weekScores.reduce((a, b) => a + b, 0) / weekScores.length : null;
      const minWeekScore = weekScores.length ? Math.min(...weekScores) : null;

      const atRiskThisWeek = weekScores.some((s) => s <= 3);

      return {
        case_id: c.id,
        case_title: c.title,
        therapist_id: c.therapist_id,
        therapist_name: c.therapist_id ? therapistNameById[c.therapist_id] ?? null : null,

        // week stats
        week_checkins: w.length,
        week_avg_score: weekAvg,
        week_min_score: minWeekScore,
        at_risk_this_week: atRiskThisWeek,

        // last checkin stats
        last_checkin_at: last?.created_at ?? null,
        last_score: typeof last?.score === "number" ? last.score : null,
      };
    })
    .filter((row) => row.at_risk_this_week)
    // Order: worst first (lowest min score), then fewer checkins, then most recent last_checkin
    .sort((a, b) => {
      const aMin = a.week_min_score ?? 999;
      const bMin = b.week_min_score ?? 999;
      if (aMin !== bMin) return aMin - bMin;

      if (a.week_checkins !== b.week_checkins) return a.week_checkins - b.week_checkins;

      const aT = a.last_checkin_at ? Date.parse(a.last_checkin_at) : 0;
      const bT = b.last_checkin_at ? Date.parse(b.last_checkin_at) : 0;
      return bT - aT;
    });

  return NextResponse.json({
    data: {
      practice_id: practiceId,
      week_start: weekStart,
      queue,
    },
    error: null,
  });
}