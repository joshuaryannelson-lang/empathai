// app/api/practices/[id]/ths/route.ts
// Thin controller — all THS logic lives in lib/services/ths.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { toMondayISO } from "@/lib/week";
import { computeTHS, bandLabel, buildMovements, buildRecommendations } from "@/lib/services/ths";
import { isScoreCritical } from "@/lib/services/risk";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoPracticeTHS } from "@/lib/demo/demoData";

function round1(n: number) { return Math.round(n * 10) / 10; }

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: practiceId } = await ctx.params;
    if (!practiceId) {
      return NextResponse.json({ data: null, error: { message: "Missing practice id" } }, { status: 400 });
    }

    if (isDemoMode(req.url)) {
      const demoThs = getDemoPracticeTHS(practiceId);
      if (!demoThs) return NextResponse.json({ data: null, error: { message: "Practice not found" } }, { status: 404 });
      return NextResponse.json({ data: demoThs, error: null });
    }

    const url = new URL(req.url);
    const weekStartRaw = url.searchParams.get("week_start");
    const week_start = toMondayISO(weekStartRaw || new Date().toISOString().slice(0, 10));
    const prior_week_start = addDays(week_start, -7);

    // 1) Therapists
    const { data: therapists, error: tErr } = await supabase
      .from("therapists")
      .select("id,name,practice_id")
      .eq("practice_id", practiceId);
    if (tErr) return NextResponse.json({ data: null, error: tErr }, { status: 500 });

    // 2) Cases
    const { data: cases, error: cErr } = await supabase
      .from("cases")
      .select("id,practice_id,therapist_id,status")
      .eq("practice_id", practiceId);
    if (cErr) return NextResponse.json({ data: null, error: cErr }, { status: 500 });

    const caseIds = (cases ?? []).map((c) => c.id);

    // 3) Current + prior week check-ins in parallel
    let checkins: any[] = [];
    let priorCheckins: any[] = [];
    if (caseIds.length > 0) {
      const [curRes, priorRes] = await Promise.all([
        supabase.from("checkins").select("id,case_id,score").eq("week_start", week_start).in("case_id", caseIds),
        supabase.from("checkins").select("id,case_id,score").eq("week_start", prior_week_start).in("case_id", caseIds),
      ]);
      checkins = curRes.data ?? [];
      priorCheckins = priorRes.data ?? [];
    }

    // ── Compute workload metrics ──────────────────────────────────────────────
    const casesByTherapist: Record<string, number> = {};
    for (const t of (therapists ?? [])) casesByTherapist[t.id] = 0;
    let unassignedCases = 0;
    for (const c of (cases ?? [])) {
      if (c.therapist_id && casesByTherapist[c.therapist_id] !== undefined) {
        casesByTherapist[c.therapist_id] += 1;
      } else {
        unassignedCases += 1;
      }
    }

    const counts = Object.values(casesByTherapist);
    const avgCasesPerTherapist = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const workloadSpread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;

    // ── Current week metrics ──────────────────────────────────────────────────
    const scores = checkins.map((c) => c.score).filter((n) => typeof n === "number");
    const avgCheckinScore: number | null = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const atRiskCount = checkins.filter((c) => isScoreCritical(c.score)).length;
    const casesCount = (cases ?? []).length;

    const thsComponents = computeTHS({
      avgCheckinScore,
      workloadSpread,
      unassignedCases,
      casesCount,
      checkinsCount: checkins.length,
      atRiskCount,
    });

    // ── Prior week metrics ────────────────────────────────────────────────────
    const priorScores = priorCheckins.map((c) => c.score).filter((n) => typeof n === "number");
    const priorAvgScore: number | null = priorScores.length ? priorScores.reduce((a, b) => a + b, 0) / priorScores.length : null;
    const priorAtRisk = priorCheckins.filter((c) => isScoreCritical(c.score)).length;

    const priorThs = computeTHS({
      avgCheckinScore: priorAvgScore,
      workloadSpread,
      unassignedCases,
      casesCount,
      checkinsCount: priorCheckins.length,
      atRiskCount: priorAtRisk,
    });

    const currentScore = thsComponents?.total ?? null;
    const priorScore = priorThs?.total ?? null;
    const delta = currentScore !== null && priorScore !== null ? round1(currentScore - priorScore) : null;

    // ── Movements + recommendations ───────────────────────────────────────────
    const movements = buildMovements(thsComponents, priorThs);

    const recommendations = buildRecommendations({
      score: currentScore,
      avgCheckinScore,
      unassignedCases,
      workloadSpread,
      atRiskCount,
      checkinsCount: checkins.length,
      casesCount,
      casesByTherapist,
    });

    return NextResponse.json(
      {
        data: {
          practice_id: practiceId,
          week_start,
          score: currentScore,
          band: bandLabel(currentScore),
          ths_components: thsComponents,
          trend: {
            prior_week_start,
            prior_score: priorScore,
            delta,
            direction: delta === null ? null : delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
          },
          movements,
          recommendations,
          drivers: {
            avg_checkin_score: avgCheckinScore !== null ? round1(avgCheckinScore) : null,
            therapists_count: (therapists ?? []).length,
            cases_count: casesCount,
            unassigned_cases_count: unassignedCases,
            avg_cases_per_therapist: round1(avgCasesPerTherapist),
            workload_spread: workloadSpread,
            cases_by_therapist: casesByTherapist,
            at_risk_count: atRiskCount,
            checkin_count: checkins.length,
          },
        },
        error: null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: { message: e?.message ?? String(e) } },
      { status: 500 }
    );
  }
}
