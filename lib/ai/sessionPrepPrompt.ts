// lib/ai/sessionPrepPrompt.ts
// Builds the session preparation prompt for the Anthropic API.
// NEVER includes patient identifiers — only case_code-less numeric data + goal labels.

import { scrubPrompt } from "@/lib/services/redaction";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CheckInData {
  week_index?: number | null;
  rating: number;        // 1–10
  notes: string | null;  // already client-side redacted; server-side scrub applied here
}

export interface GoalData {
  label: string;
  week_index_set?: number | null;
}

export interface SessionPrepInput {
  checkins: CheckInData[];
  goals: GoalData[];
}

export interface SessionPrepOutput {
  rating_trend: "improving" | "stable" | "declining" | "insufficient_data";
  rating_delta: number | null;
  notable_themes: string[];
  suggested_focus: string;
  data_source: string;
  confidence: "high" | "medium" | "low";
  flags: string[];
}

// ── PHI assertion ────────────────────────────────────────────────────────────

const PHI_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,          // email
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/, // phone
  /\b\d{3}-\d{2}-\d{4}\b/,                                     // SSN
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,                    // DOB
  /\b\d{1,5}\s+[A-Z][a-zA-Z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane)\b/i, // address
];

export function assertNoPHI(text: string): void {
  for (const pattern of PHI_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`PHI detected in prompt input — refusing to send to LLM. Pattern: ${pattern.source}`);
    }
  }
}

// ── Prompt builder ───────────────────────────────────────────────────────────

export function buildSessionPrepPrompt(input: SessionPrepInput): string {
  const { checkins, goals } = input;

  // Server-side redaction pass on all notes
  const scrubbed = checkins.map(c => ({
    ...c,
    notes: c.notes ? scrubPrompt(c.notes).text : null,
  }));

  // Assert no PHI remains in any note after scrubbing
  for (const c of scrubbed) {
    if (c.notes) assertNoPHI(c.notes);
  }

  const checkinLines = scrubbed
    .map((c, i) => {
      const weekLabel = c.week_index != null ? `Week ${c.week_index}` : `Check-in ${i + 1}`;
      const notePart = c.notes ? ` | Notes: "${c.notes}"` : "";
      return `- ${weekLabel}: Rating ${c.rating}/10${notePart}`;
    })
    .join("\n");

  const goalLines = goals.length > 0
    ? goals.map(g => `- ${g.label}`).join("\n")
    : "- No active goals set";

  return `You are a clinical data summarizer for a therapist's session preparation.
You will receive de-identified check-in data (ratings and notes) and active goals.
Your job is to produce a structured JSON summary. You must NEVER diagnose, prescribe,
recommend medication, or use clinical/diagnostic terminology.

DATA:
Check-ins (most recent first):
${checkinLines}

Active goals:
${goalLines}

INSTRUCTIONS:
1. Analyze the rating trend across check-ins.
2. Extract up to 3 behavioral themes from the notes (e.g., "reported difficulty sleeping",
   "engaged in social activities"). Never use diagnostic labels.
3. Write one non-prescriptive suggested_focus sentence for the therapist.
4. If fewer than 2 check-ins exist, set confidence to "low" and rating_trend to "insufficient_data".

Respond with ONLY valid JSON matching this exact schema:
{
  "rating_trend": "improving" | "stable" | "declining" | "insufficient_data",
  "rating_delta": <number or null>,
  "notable_themes": ["string", ...],
  "suggested_focus": "string",
  "data_source": "from last N check-ins",
  "confidence": "high" | "medium" | "low",
  "flags": []
}`;
}

// ── Banned term validation ───────────────────────────────────────────────────

const BANNED_FOCUS_TERMS = [
  "diagnose", "treat", "prescribe", "recommend medication",
  "clinical", "disorder", "symptom",
];

const BANNED_THEME_TERMS = [
  "depression", "anxiety disorder", "bipolar", "schizophrenia", "ptsd",
  "post-traumatic stress disorder", "obsessive-compulsive", "ocd",
  "adhd", "attention deficit", "borderline personality",
  "narcissistic personality", "antisocial personality",
  "generalized anxiety disorder", "major depressive",
  "panic disorder", "agoraphobia", "social anxiety disorder",
  "anorexia", "bulimia", "dissociative",
];

export function validateSessionPrepOutput(output: SessionPrepOutput): string[] {
  const errors: string[] = [];

  const focusLower = output.suggested_focus.toLowerCase();
  for (const term of BANNED_FOCUS_TERMS) {
    if (focusLower.includes(term)) {
      errors.push(`suggested_focus contains banned term: "${term}"`);
    }
  }

  for (const theme of output.notable_themes) {
    const themeLower = theme.toLowerCase();
    for (const term of BANNED_THEME_TERMS) {
      if (themeLower.includes(term)) {
        errors.push(`notable_themes contains diagnostic label: "${term}" in theme "${theme}"`);
      }
    }
  }

  if (output.notable_themes.length > 3) {
    errors.push(`notable_themes has ${output.notable_themes.length} items, max is 3`);
  }

  return errors;
}

// ── Estimate token count (rough: 1 token ≈ 4 chars) ─────────────────────────

export function estimateTokenCount(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}
