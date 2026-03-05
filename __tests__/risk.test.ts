import {
  classifyRisk,
  hasAtRiskScore,
  isScoreCritical,
  detectCrisisLanguage,
  RISK_THRESHOLDS,
} from "@/lib/services/risk";

describe("RISK_THRESHOLDS", () => {
  it("exports expected threshold values", () => {
    expect(RISK_THRESHOLDS.criticalScore).toBe(3);
    expect(RISK_THRESHOLDS.decliningDelta).toBe(-2);
    expect(RISK_THRESHOLDS.staleDays).toBe(7);
    expect(RISK_THRESHOLDS.monitorAvgScore).toBe(5);
  });
});

describe("classifyRisk", () => {
  const now = new Date().toISOString();
  const recent = new Date(Date.now() - 2 * 86400000).toISOString(); // 2 days ago
  const old = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago

  it("returns critical when latest score <= 3", () => {
    const result = classifyRisk([
      { score: 2, created_at: recent },
      { score: 7, created_at: old },
    ]);
    expect(result.level).toBe("critical");
    expect(result.signal).toBe("AT_RISK");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("returns declining when delta <= -2", () => {
    const result = classifyRisk([
      { score: 5, created_at: recent },
      { score: 8, created_at: old },
      { score: 9, created_at: old },
      { score: 8, created_at: old },
    ]);
    expect(result.level).toBe("declining");
    expect(result.signal).toBe("MONITOR");
  });

  it("returns stale when last check-in is too old", () => {
    const result = classifyRisk([
      { score: 7, created_at: old },
    ]);
    expect(result.level).toBe("stale");
    expect(result.signal).toBe("MISSING_CHECKIN");
  });

  it("returns stable for healthy case", () => {
    const result = classifyRisk([
      { score: 8, created_at: recent },
      { score: 7, created_at: recent },
    ]);
    expect(result.level).toBe("stable");
    expect(result.signal).toBe("OK");
  });

  it("returns stable for empty check-ins", () => {
    const result = classifyRisk([]);
    expect(result.level).toBe("stable");
    expect(result.signal).toBe("OK");
  });
});

describe("hasAtRiskScore", () => {
  it("returns true when any score is at or below critical", () => {
    expect(hasAtRiskScore([7, 2, 8])).toBe(true);
  });

  it("returns false when all scores are above critical", () => {
    expect(hasAtRiskScore([7, 5, 8])).toBe(false);
  });

  it("ignores null scores", () => {
    expect(hasAtRiskScore([null, null])).toBe(false);
  });
});

describe("isScoreCritical", () => {
  it("returns true for score <= 3", () => {
    expect(isScoreCritical(3)).toBe(true);
    expect(isScoreCritical(1)).toBe(true);
  });

  it("returns false for score > 3", () => {
    expect(isScoreCritical(4)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isScoreCritical(null)).toBe(false);
  });
});

describe("detectCrisisLanguage", () => {
  it("detects suicide-related language", () => {
    expect(detectCrisisLanguage("I want to kill myself")).toBe(true);
  });

  it("detects self-harm language", () => {
    expect(detectCrisisLanguage("thinking about self-harm")).toBe(true);
  });

  it("detects hopelessness", () => {
    expect(detectCrisisLanguage("everything is hopeless")).toBe(true);
  });

  it("returns false for benign text", () => {
    expect(detectCrisisLanguage("Had a good day today")).toBe(false);
  });

  it("returns false for empty/null input", () => {
    expect(detectCrisisLanguage("")).toBe(false);
    expect(detectCrisisLanguage(null as unknown as string)).toBe(false);
  });
});
