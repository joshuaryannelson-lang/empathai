// app/api/practices/[id]/ths/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { toMondayISO } from "@/lib/week";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function bandLabel(score: number | null) {
  if (score === null) return "No data yet";
  if (score < 4) return "Needs attention";
  if (score < 7) return "Balanced";
  return "Optimal";
}

// very lightweight "explainability" layer for demo/investors
function buildInsights(args: {
  score: number | null;
  avgCheckinScore: number | null;
  workloadSpread: number;
  unassignedCases: number;
  therapistsCount: number;
  casesCount: number;
  avgCasesPerTherapist: number;
}) {
  const {
    score,
    avgCheckinScore,
    workloadSpread,
    unassignedCases,
    therapistsCount,
    casesCount,
    avgCasesPerTherapist,
  } = args;

  // Reproduce penalties (must match scoring logic)
  const imbalancePenalty =
    avgCheckinScore === null ? 0 : Math.min(2, workloadSpread * 0.5);
  const unassignedPenalty =
    avgCheckinScore === null ? 0 : Math.min(2, unassignedCases * 0.25);

  // Deltas are signed contributions (what pushed score down/up)
  const deltas = {
    unassigned_cases_penalty: avgCheckinScore === null ? null : -round1(unassignedPenalty),
    workload_spread_penalty: avgCheckinScore === null ? null : -round1(imbalancePenalty),
    avg_checkin_baseline: avgCheckinScore === null ? null : round1(avgCheckinScore),
  };

  const label = bandLabel(score);

  const bullets: string[] = [];
  const recommendations: Array<{
    id: string;
    title: string;
    impact: { score_delta_est: number };
    details: string;
  }> = [];

  // Bullets: always include some signal + at least one "good news" when possible
  if (avgCheckinScore === null) {
    bullets.push("No check-ins logged for this week, so THS can’t be computed yet.");
    bullets.push(`Current workload snapshot: ${casesCount} case(s), ${therapistsCount} therapist(s).`);
    if (unassignedCases > 0) bullets.push(`${unassignedCases} case(s) are unassigned.`);
  } else {
    bullets.push(`Avg check-in score this week is ${round1(avgCheckinScore)} (baseline outcome signal).`);
    bullets.push(`Workload spread is ${workloadSpread} (max cases per therapist minus min).`);
    bullets.push(`${unassignedCases} case(s) are unassigned.`);

    // a "good news" line
    if (workloadSpread === 0 && therapistsCount > 0) {
      bullets.push("Workload distribution is even across therapists (spread = 0).");
    } else if (therapistsCount > 0) {
      bullets.push(`Avg cases per therapist is ${round1(avgCasesPerTherapist)}.`);
    }
  }

  // Recommendations + impact estimates (simple, consistent with penalties)
  // Unassigned cases: each case up to 0.25 penalty until cap 2.0
  if (avgCheckinScore !== null && unassignedCases > 0) {
    const estDelta = round1(Math.min(0.25, 2 - unassignedPenalty)); // effect of assigning 1 case, respecting cap
    recommendations.push({
      id: "assign_unassigned_cases",
      title: "Assign unassigned case(s)",
      impact: { score_delta_est: estDelta },
      details:
        "Unassigned cases create a direct THS penalty. Assigning cases removes that penalty and improves workload clarity.",
    });
  }

  // Workload spread: reducing spread by 1 reduces penalty by 0.5 until cap 2.0
  if (avgCheckinScore !== null && workloadSpread > 0) {
    const estDelta = round1(Math.min(0.5, 2 - imbalancePenalty)); // effect of reducing spread by ~1, respecting cap
    recommendations.push({
      id: "rebalance_workload",
      title: "Rebalance caseload distribution",
      impact: { score_delta_est: estDelta },
      details:
        "Large workload spread increases burnout risk and reduces THS. Moving a case from the most-loaded therapist to the least-loaded improves balance.",
    });
  }

  // If we have check-ins but score is low, suggest “identify at-risk” (placeholder for future AI)
  if (avgCheckinScore !== null && score !== null && score < 7) {
    recommendations.push({
      id: "review_at_risk_cases",
      title: "Review at-risk cases (low check-in scores)",
      impact: { score_delta_est: 0.3 },
      details:
        "Scan for cases with low check-in scores and prioritize follow-ups. (Later: AI narrative can highlight likely root causes.)",
    });
  }

  // Summary sentence
  let summary = "";
  if (score === null) {
    summary = "No THS yet. Add at least one check-in this week to compute a baseline score.";
  } else if (label === "Optimal") {
    summary = `Optimal (${score}). Keep distribution steady and maintain outcomes.`;
  } else if (label === "Balanced") {
    if (unassignedCases > 0) {
      summary = `Balanced (${score}). Assigning ${Math.min(unassignedCases, 1)} unassigned case could push this toward optimal.`;
    } else if (workloadSpread > 0) {
      summary = `Balanced (${score}). Reducing workload spread by 1 could push this toward optimal.`;
    } else {
      summary = `Balanced (${score}). Small improvements to outcomes can move this into optimal.`;
    }
  } else {
    summary = `Needs attention (${score}). Focus on unassigned cases and workload imbalance first.`;
  }

  // keep only top 2 recs for demo cleanliness
  const trimmedRecs = recommendations.slice(0, 2);

  return {
    label,
    summary,
    bullets,
    recommendations: trimmedRecs,
    deltas,
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: practiceId } = await ctx.params;

    if (!practiceId) {
      return NextResponse.json(
        { data: null, error: { message: "Missing practice id" } },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const weekStartRaw = url.searchParams.get("week_start");
    const week_start = toMondayISO(
      weekStartRaw || new Date().toISOString().slice(0, 10)
    );

    // 1) Pull therapists in this practice
    const therapistsRes = await supabase
      .from("therapists")
      .select("id,name,practice_id,created_at")
      .eq("practice_id", practiceId);

    if (therapistsRes.error) {
      return NextResponse.json(
        { data: null, error: therapistsRes.error },
        { status: 500 }
      );
    }
    const therapists = therapistsRes.data ?? [];

    // 2) Pull cases in this practice (assigned + unassigned)
    const casesRes = await supabase
      .from("cases")
      .select("id,practice_id,therapist_id,status,created_at")
      .eq("practice_id", practiceId);

    if (casesRes.error) {
      return NextResponse.json(
        { data: null, error: casesRes.error },
        { status: 500 }
      );
    }
    const cases = casesRes.data ?? [];

    const caseIds = cases.map((c) => c.id);

    // 3) Pull checkins for this week for all cases in the practice
    let checkins: any[] = [];
    if (caseIds.length > 0) {
      const checkinsRes = await supabase
        .from("checkins")
        .select("id,case_id,week_start,score,created_at")
        .eq("week_start", week_start)
        .in("case_id", caseIds);

      if (checkinsRes.error) {
        return NextResponse.json(
          { data: null, error: checkinsRes.error },
          { status: 500 }
        );
      }
      checkins = checkinsRes.data ?? [];
    }

    // ---- Metrics / drivers ----

    // Workload: cases per therapist
    const casesByTherapist: Record<string, number> = {};
    for (const t of therapists) casesByTherapist[t.id] = 0;

    let unassignedCases = 0;
    for (const c of cases) {
      if (c.therapist_id && casesByTherapist[c.therapist_id] !== undefined) {
        casesByTherapist[c.therapist_id] += 1;
      } else {
        unassignedCases += 1;
      }
    }

    const counts = Object.values(casesByTherapist);
    const avgCasesPerTherapist = counts.length
      ? counts.reduce((a, b) => a + b, 0) / counts.length
      : 0;
    const maxCasesPerTherapist = counts.length ? Math.max(...counts) : 0;
    const minCasesPerTherapist = counts.length ? Math.min(...counts) : 0;
    const workloadSpread = maxCasesPerTherapist - minCasesPerTherapist;

    // Outcomes proxy: average check-in score for the week (across cases)
    const scores = checkins.map((c) => c.score).filter((n) => typeof n === "number");
    const avgCheckinScore = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

    // Composite “practice THS” (simple demo math)
    let score: number | null = null;
    if (avgCheckinScore !== null) {
      const imbalancePenalty = Math.min(2, workloadSpread * 0.5); // up to -2
      const unassignedPenalty = Math.min(2, unassignedCases * 0.25); // up to -2
      const raw = avgCheckinScore - imbalancePenalty - unassignedPenalty;
      score = clamp(round1(raw), 0, 10);
    }

    const insights = buildInsights({
      score,
      avgCheckinScore,
      workloadSpread,
      unassignedCases,
      therapistsCount: therapists.length,
      casesCount: cases.length,
      avgCasesPerTherapist,
    });

    return NextResponse.json(
      {
        data: {
          practice_id: practiceId,
          week_start,
          score,
          drivers: {
            avg_checkin_score: avgCheckinScore,
            therapists_count: therapists.length,
            cases_count: cases.length,
            unassigned_cases_count: unassignedCases,
            avg_cases_per_therapist: round1(avgCasesPerTherapist),
            workload_spread: workloadSpread,
            cases_by_therapist: casesByTherapist,
          },
          insights,
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