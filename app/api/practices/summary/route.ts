// app/api/practices/summary/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function addDaysISO(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("week_start");

  if (!weekStart) {
    return NextResponse.json(
      { data: null, error: "Missing week_start" },
      { status: 400 }
    );
  }

  const weekEndISO = addDaysISO(weekStart, 7);

  // 1) Practices
  const { data: practices, error: pErr } = await supabase
    .from("practice")
    .select("id, name")
    .order("name", { ascending: true });

  if (pErr) return NextResponse.json({ data: null, error: pErr }, { status: 500 });
  if (!practices?.length) return NextResponse.json({ data: [], error: null });

  const practiceIds = practices.map((p) => p.id);

  // 2) Therapists (scoped to practices)
  const { data: therapists, error: tErr } = await supabase
    .from("therapists")
    .select("id, practice_id")
    .in("practice_id", practiceIds);

  if (tErr) return NextResponse.json({ data: null, error: tErr }, { status: 500 });

  // 3) Cases (scoped to practices)
  const { data: cases, error: cErr } = await supabase
    .from("cases")
    .select("id, practice_id, therapist_id")
    .in("practice_id", practiceIds);

  if (cErr) return NextResponse.json({ data: null, error: cErr }, { status: 500 });

  const caseIds = (cases ?? []).map((c) => c.id);

  // 4) Checkins (scoped to cases + week)
  const { data: checkins, error: ciErr } = caseIds.length
    ? await supabase
        .from("checkins")
        .select("case_id, score, created_at")
        .in("case_id", caseIds)
        .gte("created_at", weekStart)
        .lt("created_at", weekEndISO)
    : { data: [], error: null };

  if (ciErr) return NextResponse.json({ data: null, error: ciErr }, { status: 500 });

  // ---- Aggregate ----
  const therapistsByPractice: Record<string, number> = {};
  for (const t of therapists ?? []) {
    therapistsByPractice[t.practice_id] = (therapistsByPractice[t.practice_id] ?? 0) + 1;
  }

  const casesByPractice: Record<string, number> = {};
  const unassignedByPractice: Record<string, number> = {};
  const practiceByCase: Record<string, string> = {};

  for (const c of cases ?? []) {
    casesByPractice[c.practice_id] = (casesByPractice[c.practice_id] ?? 0) + 1;

    if (!c.therapist_id) {
      unassignedByPractice[c.practice_id] = (unassignedByPractice[c.practice_id] ?? 0) + 1;
    }

    practiceByCase[c.id] = c.practice_id;
  }

  const checkinsByPractice: Record<
    string,
    { count: number; sum: number; scored: number; low: number }
  > = {};

  for (const ci of checkins ?? []) {
    const pid = practiceByCase[ci.case_id];
    if (!pid) continue;

    const bucket = (checkinsByPractice[pid] ??= { count: 0, sum: 0, scored: 0, low: 0 });
    bucket.count += 1;

    if (typeof ci.score === "number") {
      bucket.sum += ci.score;
      bucket.scored += 1;
      if (ci.score <= 3) bucket.low += 1;
    }
  }

  const result = practices.map((p) => {
    const ci = checkinsByPractice[p.id] ?? { count: 0, sum: 0, scored: 0, low: 0 };
    const avg = ci.scored ? ci.sum / ci.scored : null;

    return {
      id: p.id,
      name: p.name ?? null,
      therapists: therapistsByPractice[p.id] ?? 0,
      cases: casesByPractice[p.id] ?? 0,
      unassigned_cases: unassignedByPractice[p.id] ?? 0,
      week_checkins: ci.count,
      week_avg_score: avg,
      at_risk_checkins: ci.low,
    };
  });

  return NextResponse.json({ data: result, error: null });
}