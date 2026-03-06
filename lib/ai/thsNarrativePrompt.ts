// lib/ai/thsNarrativePrompt.ts
// Builds a prompt for the LLM to produce a 2–3 sentence narrative explaining THS drivers.
// NEVER prescriptive — explains what's driving the score, never recommends actions.

import type { THSResult } from "./thsScoring";

export function buildTHSNarrativePrompt(result: THSResult, weekIndex?: number | null): string {
  const { score, components } = result;
  const weekLabel = weekIndex != null ? `Week ${weekIndex}` : "This period";

  return `You are a clinical data narrator. Given a patient's Therapeutic Health Score (THS)
and its component scores, write a 2–3 sentence plain-language explanation of what is driving
the score. Be factual and non-prescriptive. NEVER diagnose, treat, prescribe, recommend
medication, or use the words "disorder", "symptom", or "clinical".

THS Score: ${score}/10
Components:
- Wellbeing (W): ${components.W}/10 — average self-reported check-in rating
- Session Engagement (S): ${components.S}/10 — therapist-rated session participation
- Outcome Progress (O): ${components.O}/10 — goal completion rate
- Therapeutic Alliance (T): ${components.T}/10 — therapist-rated working relationship

Period: ${weekLabel}

Write exactly 2–3 sentences. No bullet points. No recommendations. Just explain what the
numbers show. Respond with ONLY the narrative text, no JSON or formatting.`;
}

// ── Banned term check for narrative output ───────────────────────────────────

const BANNED_NARRATIVE_TERMS = [
  "diagnose", "treat", "disorder", "medication",
  "prescribe", "symptom", "clinical",
];

export function validateNarrative(narrative: string): string[] {
  const errors: string[] = [];
  const lower = narrative.toLowerCase();
  for (const term of BANNED_NARRATIVE_TERMS) {
    if (lower.includes(term)) {
      errors.push(`Narrative contains banned term: "${term}"`);
    }
  }

  const sentences = narrative.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 3) {
    errors.push(`Narrative has ${sentences.length} sentences, max is 3`);
  }

  return errors;
}
