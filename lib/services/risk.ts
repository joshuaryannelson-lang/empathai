// lib/services/risk.ts
// Centralized risk classification. All threshold checks live here — never inline.

import { SIGNAL, type Signal } from "@/lib/constants";

// ── Exported thresholds (single source of truth) ────────────────────────────

export const RISK_THRESHOLDS = {
  /** Score at or below this value is "critical" / at-risk */
  criticalScore: 3,
  /** Delta at or below this value flags a declining trend */
  decliningDelta: -2,
  /** Days without a check-in before flagging "stale" */
  staleDays: 7,
  /** Weekly average at or below this triggers MONITOR signal */
  monitorAvgScore: 5,
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "critical" | "declining" | "stale" | "stable";

export interface CheckIn {
  score: number | null;
  created_at: string;
}

export interface RiskSignal {
  level: RiskLevel;
  signal: Signal;
  reasons: string[];
}

// ── Core classifier ─────────────────────────────────────────────────────────

/**
 * Classify a case's risk level from its check-in history.
 * First check-in in the array is assumed to be the most recent.
 */
export function classifyRisk(checkins: CheckIn[]): RiskSignal {
  const reasons: string[] = [];
  const scores = checkins.map(c => c.score).filter((s): s is number => s !== null);
  const latest = checkins[0] ?? null;
  const latestScore = latest?.score ?? null;

  // Critical: latest score at or below threshold
  if (latestScore !== null && latestScore <= RISK_THRESHOLDS.criticalScore) {
    reasons.push(`Latest score ${latestScore} <= ${RISK_THRESHOLDS.criticalScore}`);
    return { level: "critical", signal: SIGNAL.AT_RISK, reasons };
  }

  // Declining: compare latest to baseline (avg of next 3)
  if (scores.length >= 2) {
    const baseline = scores.slice(1, 4);
    const baselineAvg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const delta = latestScore !== null ? latestScore - baselineAvg : null;
    if (delta !== null && delta <= RISK_THRESHOLDS.decliningDelta) {
      reasons.push(`Delta ${delta.toFixed(1)} <= ${RISK_THRESHOLDS.decliningDelta}`);
      return { level: "declining", signal: SIGNAL.MONITOR, reasons };
    }
  }

  // Stale: no recent check-in
  if (latest?.created_at) {
    const daysSince = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 86400000);
    if (daysSince >= RISK_THRESHOLDS.staleDays) {
      reasons.push(`${daysSince} days since last check-in (>= ${RISK_THRESHOLDS.staleDays})`);
      return { level: "stale", signal: SIGNAL.MISSING_CHECKIN, reasons };
    }
  }

  return { level: "stable", signal: SIGNAL.OK, reasons: [] };
}

// ── Helpers for batch operations ────────────────────────────────────────────

/** Returns true if any score in the array is at or below the critical threshold. */
export function hasAtRiskScore(scores: (number | null)[]): boolean {
  return scores.some(s => typeof s === "number" && s <= RISK_THRESHOLDS.criticalScore);
}

/** Returns true if a single score is at or below the critical threshold. */
export function isScoreCritical(score: number | null): boolean {
  return typeof score === "number" && score <= RISK_THRESHOLDS.criticalScore;
}

// ── Crisis language detection (canonical implementation in lib/crisis-detection.ts) ──

export { detectCrisisLanguage } from "@/lib/crisis-detection";
