// lib/services/ths.ts
// Therapeutic Health Score computation. All THS weights and formulas live here.

// ── Exported weights (single source of truth) ───────────────────────────────

export const THS_WEIGHTS = {
  workload: 0.25,
  satisfaction: 0.25,
  outcomes: 0.35,
  stability: 0.15,
} as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function round1(n: number) { return Math.round(n * 10) / 10; }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

// ── Types ────────────────────────────────────────────────────────────────────

export type THSComponents = {
  total: number;
  workload: number;
  satisfaction: number;
  outcomes: number;
  stability: number;
};

export type THSBand = "Optimal" | "Balanced" | "Needs attention" | "No data";

export type Movement = { direction: "up" | "down"; label: string; detail: string };

export type Recommendation = { priority: "high" | "medium" | "low"; action: string; reason: string };

// ── Core THS formula ────────────────────────────────────────────────────────
// THS = W·Workload + W·Satisfaction + W·Outcomes + W·Stability

export function computeTHS(args: {
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
    THS_WEIGHTS.workload * workload +
    THS_WEIGHTS.satisfaction * satisfaction +
    THS_WEIGHTS.outcomes * outcomes +
    THS_WEIGHTS.stability * stability
  ), 0, 10);

  return {
    total,
    workload: round1(clamp(workload, 0, 10)),
    satisfaction: round1(clamp(satisfaction, 0, 10)),
    outcomes: round1(clamp(outcomes, 0, 10)),
    stability: round1(clamp(stability, 0, 10)),
  };
}

// ── Band label ──────────────────────────────────────────────────────────────

export function bandLabel(score: number | null): THSBand {
  if (score === null) return "No data";
  if (score >= 7) return "Optimal";
  if (score >= 4) return "Balanced";
  return "Needs attention";
}

// ── What moved THS ──────────────────────────────────────────────────────────

export function buildMovements(cur: THSComponents | null, prior: THSComponents | null): Movement[] {
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

// ── Recommended actions ─────────────────────────────────────────────────────

export function buildRecommendations(args: {
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
