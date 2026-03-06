// lib/ai/thsScoring.ts
// Patient-level Therapeutic Health Score — DETERMINISTIC, no LLM.
// Formula: THS = (0.25 * W) + (0.25 * S) + (0.35 * O) + (0.15 * T)

export const PATIENT_THS_WEIGHTS = {
  W: 0.25,  // Wellbeing (avg check-in rating, 0–10)
  S: 0.25,  // Session engagement (therapist-submitted, 0–10)
  O: 0.35,  // Outcome progress (goal completion rate, 0–10)
  T: 0.15,  // Therapeutic alliance (therapist-submitted, 0–10)
} as const;

export interface THSInput {
  W: number | null;  // Wellbeing
  S: number | null;  // Session engagement
  O: number | null;  // Outcome progress
  T: number | null;  // Therapeutic alliance
}

export interface THSResult {
  score: number;
  components: { W: number; S: number; O: number; T: number };
  confidence: "high" | "medium" | "low";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateTHS(input: THSInput): THSResult {
  const hasNull = input.W === null || input.S === null || input.O === null || input.T === null;
  const nullCount = [input.W, input.S, input.O, input.T].filter(v => v === null).length;

  // Use 0 as default for null components
  const W = clamp(input.W ?? 0, 0, 10);
  const S = clamp(input.S ?? 0, 0, 10);
  const O = clamp(input.O ?? 0, 0, 10);
  const T = clamp(input.T ?? 0, 0, 10);

  const score = round2(
    PATIENT_THS_WEIGHTS.W * W +
    PATIENT_THS_WEIGHTS.S * S +
    PATIENT_THS_WEIGHTS.O * O +
    PATIENT_THS_WEIGHTS.T * T
  );

  let confidence: "high" | "medium" | "low";
  if (!hasNull) {
    confidence = "high";
  } else if (nullCount <= 2) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    score: clamp(score, 0, 10),
    components: { W, S, O, T },
    confidence,
  };
}
