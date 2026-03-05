// app/api/practices/[id]/ths/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { toMondayISO } from "@/lib/week";

function round1(n: number) { return Math.round(n * 10) / 10; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── THS formula from spec ────────────────────────────────────────────────────
// THS = 0.25·Workload + 0.25·Satisfaction + 0.35·Outcomes + 0.15·Stability

type THSComponents = {
  total: number;
  workload: number;
  satisfaction: number;
  outcomes: number;
  stability: number;
};

function computeTHS(args: {
  avgCheckinScore: number | null;
  workloadSpread: number;
  unassignedCases: number;
  casesCount: number;
  checkinsCount: number;
  atRiskCount: number;
}): THSComponents | null {
  const { avgCheckinScore, workloadSpread, unassignedCases, casesCount, checkinsCount, atRiskCount } = args;

  if (avgCheckinScore === null) return null;

  // Workload (0–10): perfectly balanced = 10; spread of 7+ = 0
  const workload = clamp(10 - workloadSpread * 1.4, 0, 10);

  // Satisfaction (0–10): average patient check-in score
  const satisfaction = clamp(avgCheckinScore, 0, 10);

  // Outcomes (0–10): satisfaction weighted by engagement rate (% of cases with check-ins)
  const engagementRate = casesCount > 0 ? Math.min(1, checkinsCount / casesCount) : 0;
  const outcomes = clamp(avgCheckinScore * (0.4 + 0.6 * engagementRate), 0, 10);

  // Stability (0–10): penalized by unassigned cases and at-risk signals
  const stability = clamp(10 - unassignedCases * 0.9 - atRiskCount * 0.6, 0, 10);

  const total = clamp(round1(
    0.25 * workload + 0.25 * satisfaction + 0.35 * outcomes + 0.15 * stability
  ), 0, 10);

  return {
    total,
    workload: round1(clamp(workload, 0, 10)),
    satisfaction: round1(clamp(satisfaction, 0, 10)),
    outcomes: round1(clamp(outcomes, 0, 10)),
    stability: round1(clamp(stability, 0, 10)),
  };
}

function bandLabel(score: number | null): "Optimal" | "Balanced" | "Needs attention" | "No data" {
  if (score === null) return "No data";
  if (score >= 7) return "Optimal";
  if (score >= 4) return "Balanced";
  return "Needs attention";
}

// ── What moved THS ───────────────────────────────────────────────────────────

type Movement = { direction: "up" | "down"; label: string; detail: string };

function buildMovements(cur: THSComponents | null, prior: THSComponents | null): Movement[] {
  if (!cur || !prior) return [];

  const THRESHOLD = 0.25;
  const meta: Record<string, { label: string; upDetail: string; downDetail: string }> = {
    workload: {
      label: "Caseload balance",
      upDetail: "Caseload better distributed across therapists",
      downDetail: "Caseload variance rising between therapists",
    },
    satisfaction: {
      label: "Patient satisfaction",
      upDetail: "Average check-in scores improved this week",
      downDetail: "Check-in scores declining this week",
    },
    outcomes: {
      label: "Outcome engagement",
      upDetail: "More patients completing weekly check-ins",
      downDetail: "Patient engagement with check-ins is lower",
    },
    stability: {
      label: "Practice stability",
      upDetail: "Fewer unassigned cases and at-risk signals",
      downDetail: "Unassigned cases or at-risk signals increased",
    },
  };

  const movements: Array<Movement & { delta: number }> = [];

  for (const key of ["workload", "satisfaction", "outcomes", "stability"] as const) {
    const delta = cur[key] - prior[key];
    if (Math.abs(delta) >= THRESHOLD) {
      const m = meta[key];
      movements.push({
        direction: delta > 0 ? "up" : "down",
        label: m.label,
        detail: delta > 0 ? m.upDetail : m.downDetail,
        delta: round1(delta),
      });
    }
  }

  // Downs first, then ups; within each group, largest delta first
  movements.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === "down" ? -1 : 1;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  return movements.slice(0, 4).map(({ direction, label, detail }) => ({ direction, label, detail }));
}

// ── Recommended actions ──────────────────────────────────────────────────────

type Recommendation = { priority: "high" | "medium" | "low"; action: string; reason: string };

function buildRecommendations(args: {
  score: number | null;
  avgCheckinScore: number | null;
  unassignedCases: number;
  workloadSpread: number;
  atRiskCount: number;
  checkinsCount: number;
  casesCount: number;
  casesByTherapist: Record<string, number>;
}): Recommendation[] {
  const { score, avgCheckinScore, unassignedCases, workloadSpread, atRiskCount, checkinsCount, casesCount, casesByTherapist } = args;

  const recs: Array<Recommendation & { order: number }> = [];

  if (avgCheckinScore === null || checkinsCount === 0) {
    recs.push({ priority: "high", action: "Encourage patients to submit their weekly check-ins", reason: "No check-in data this week — THS cannot be computed without engagement signals.", order: 0 });
    return recs.map(({ priority, action, reason }) => ({ priority, action, reason }));
  }

  if (unassignedCases > 0) {
    recs.push({ priority: "high", action: `Assign ${unassignedCases} unassigned case${unassignedCases > 1 ? "s" : ""} to a therapist`, reason: "Unassigned cases reduce both Stability and Outcomes scores.", order: 1 });
  }

  if (atRiskCount > 0) {
    recs.push({ priority: "high", action: `Review ${atRiskCount} at-risk patient${atRiskCount > 1 ? "s" : ""} flagged by low check-in scores`, reason: "Low scores signal disengagement or crisis risk — review before the next session.", order: 2 });
  }

  if (workloadSpread > 2) {
    const entries = Object.entries(casesByTherapist).sort((a, b) => b[1] - a[1]);
    if (entries.length >= 2) {
      recs.push({ priority: "medium", action: "Rebalance caseload — move cases from the highest-loaded to the lightest therapist", reason: `Workload spread of ${workloadSpread} is dragging down the Workload component.`, order: 3 });
    }
  }

  const engagementRate = casesCount > 0 ? checkinsCount / casesCount : 0;
  if (engagementRate < 0.5 && casesCount > 0) {
    recs.push({ priority: "medium", action: "Send check-in reminders to patients who haven't submitted this week", reason: `Only ${Math.round(engagementRate * 100)}% of cases have check-ins — low engagement reduces the Outcomes score.`, order: 4 });
  }

  if (score !== null && score >= 7 && recs.length === 0) {
    recs.push({ priority: "low", action: "Maintain current caseload distribution and check-in cadence", reason: "THS is in the optimal range — sustain the momentum.", order: 5 });
  }

  return recs.sort((a, b) => a.order - b.order).slice(0, 3).map(({ priority, action, reason }) => ({ priority, action, reason }));
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
    const atRiskCount = checkins.filter((c) => typeof c.score === "number" && c.score <= 3).length;
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
    const priorAtRisk = priorCheckins.filter((c) => typeof c.score === "number" && c.score <= 3).length;

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
