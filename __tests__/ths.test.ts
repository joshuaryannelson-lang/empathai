import {
  computeTHS,
  bandLabel,
  buildMovements,
  buildRecommendations,
  THS_WEIGHTS,
  type THSComponents,
} from "@/lib/services/ths";

describe("THS_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum = THS_WEIGHTS.workload + THS_WEIGHTS.satisfaction + THS_WEIGHTS.outcomes + THS_WEIGHTS.stability;
    expect(sum).toBeCloseTo(1.0);
  });
});

describe("computeTHS", () => {
  it("returns null when avgCheckinScore is null", () => {
    expect(computeTHS({
      avgCheckinScore: null,
      workloadSpread: 0,
      unassignedCases: 0,
      casesCount: 10,
      checkinsCount: 10,
      atRiskCount: 0,
    })).toBeNull();
  });

  it("computes known inputs correctly", () => {
    const result = computeTHS({
      avgCheckinScore: 8,
      workloadSpread: 2,
      unassignedCases: 0,
      casesCount: 10,
      checkinsCount: 10,
      atRiskCount: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.total).toBeGreaterThan(0);
    expect(result!.total).toBeLessThanOrEqual(10);
    expect(result!.satisfaction).toBeCloseTo(8, 0);
  });

  it("handles all zeros (except avgCheckinScore)", () => {
    const result = computeTHS({
      avgCheckinScore: 5,
      workloadSpread: 0,
      unassignedCases: 0,
      casesCount: 0,
      checkinsCount: 0,
      atRiskCount: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.workload).toBe(10);
    expect(result!.stability).toBe(10);
  });

  it("handles all tens (high engagement, perfect scores)", () => {
    const result = computeTHS({
      avgCheckinScore: 10,
      workloadSpread: 0,
      unassignedCases: 0,
      casesCount: 10,
      checkinsCount: 10,
      atRiskCount: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.total).toBe(10);
    expect(result!.workload).toBe(10);
    expect(result!.satisfaction).toBe(10);
    expect(result!.outcomes).toBe(10);
    expect(result!.stability).toBe(10);
  });

  it("clamps components to 0-10 range", () => {
    const result = computeTHS({
      avgCheckinScore: 2,
      workloadSpread: 20,
      unassignedCases: 20,
      casesCount: 1,
      checkinsCount: 0,
      atRiskCount: 20,
    });
    expect(result).not.toBeNull();
    expect(result!.workload).toBe(0);
    expect(result!.stability).toBe(0);
    expect(result!.total).toBeGreaterThanOrEqual(0);
  });
});

describe("bandLabel", () => {
  it("returns correct bands", () => {
    expect(bandLabel(null)).toBe("No data");
    expect(bandLabel(8)).toBe("Optimal");
    expect(bandLabel(5)).toBe("Balanced");
    expect(bandLabel(2)).toBe("Needs attention");
  });
});

describe("buildMovements", () => {
  it("returns empty when either is null", () => {
    expect(buildMovements(null, null)).toEqual([]);
    expect(buildMovements({ total: 5, workload: 5, satisfaction: 5, outcomes: 5, stability: 5 }, null)).toEqual([]);
  });

  it("detects significant movements", () => {
    const cur: THSComponents = { total: 7, workload: 8, satisfaction: 7, outcomes: 7, stability: 7 };
    const prior: THSComponents = { total: 6, workload: 5, satisfaction: 7, outcomes: 7, stability: 7 };
    const moves = buildMovements(cur, prior);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].label).toBe("Caseload balance");
    expect(moves[0].direction).toBe("up");
  });

  it("returns empty when no significant changes", () => {
    const cur: THSComponents = { total: 7, workload: 7, satisfaction: 7, outcomes: 7, stability: 7 };
    const prior: THSComponents = { total: 7, workload: 7, satisfaction: 7, outcomes: 7, stability: 7 };
    expect(buildMovements(cur, prior)).toEqual([]);
  });
});

describe("buildRecommendations", () => {
  it("recommends check-in encouragement when no data", () => {
    const recs = buildRecommendations({
      score: null,
      avgCheckinScore: null,
      unassignedCases: 0,
      workloadSpread: 0,
      atRiskCount: 0,
      checkinsCount: 0,
      casesCount: 10,
      casesByTherapist: {},
    });
    expect(recs.length).toBe(1);
    expect(recs[0].priority).toBe("high");
  });

  it("flags unassigned cases and at-risk", () => {
    const recs = buildRecommendations({
      score: 5,
      avgCheckinScore: 6,
      unassignedCases: 3,
      workloadSpread: 0,
      atRiskCount: 2,
      checkinsCount: 8,
      casesCount: 10,
      casesByTherapist: { a: 5, b: 5 },
    });
    expect(recs.length).toBeGreaterThanOrEqual(2);
    expect(recs.some(r => r.action.includes("unassigned"))).toBe(true);
    expect(recs.some(r => r.action.includes("at-risk"))).toBe(true);
  });
});
