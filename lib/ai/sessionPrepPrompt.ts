// lib/ai/sessionPrepPrompt.ts
// Builds the session preparation prompt for the Anthropic API.
// NEVER includes patient identifiers — only case_code-less numeric data + goal labels.

import { scrubPrompt } from "@/lib/services/redaction";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CheckInData {
  week_label?: string | null; // e.g. "Week of Mar 3"
  rating: number;        // 1–10
  notes: string | null;  // already client-side redacted; server-side scrub applied here
}

export interface GoalData {
  label: string;
  status?: "active" | "completed" | string;
}

export interface SessionPrepInput {
  checkins: CheckInData[];
  goals: GoalData[];
  patientFirstName?: string; // Used for send_this personalization only
  clinicalNotes?: string | null; // Therapist clinical notes (scrubbed, max 500 chars)
  modalities?: string[];     // Therapist's therapeutic approaches (e.g. ['CBT', 'ACT'])
  dsmContext?: string[];     // Plain-language descriptions translated from DSM codes — NEVER raw codes
}

export interface SessionPrepOutput {
  // Trend & metadata
  rating_trend: "improving" | "stable" | "declining" | "insufficient_data";
  rating_delta: number | null;
  data_source: string;
  confidence: "high" | "medium" | "low";
  flags: string[];

  // The 4 high-value cards
  open_with: string | null;
  watch_for: string | null;
  try_this: string | null;
  send_this: string | null;
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
  const { checkins, goals, patientFirstName, clinicalNotes, modalities, dsmContext } = input;

  // Server-side redaction pass on all notes
  const scrubbed = checkins.map(c => ({
    ...c,
    notes: c.notes ? scrubPrompt(c.notes).text : null,
  }));

  // Assert no PHI remains in any note after scrubbing
  for (const c of scrubbed) {
    if (c.notes) assertNoPHI(c.notes);
  }

  // Scrub + assert clinical notes if present
  let scrubbedClinicalNotes: string | null = null;
  if (clinicalNotes) {
    const truncated = clinicalNotes.slice(0, 500);
    scrubbedClinicalNotes = scrubPrompt(truncated).text;
    assertNoPHI(scrubbedClinicalNotes);
  }

  const checkinLines = scrubbed
    .map((c, i) => {
      const weekLabel = c.week_label ?? `Check-in ${i + 1}`;
      const notePart = c.notes ? ` | Notes: "${c.notes}"` : "";
      return `- ${weekLabel}: Rating ${c.rating}/10${notePart}`;
    })
    .join("\n");

  const activeGoals = goals.filter(g => g.status !== "completed");
  const completedGoals = goals.filter(g => g.status === "completed");
  const goalLines = activeGoals.length > 0 || completedGoals.length > 0
    ? [
        ...activeGoals.map(g => `- [ACTIVE] ${g.label}`),
        ...completedGoals.map(g => `- [COMPLETED] ${g.label}`),
      ].join("\n")
    : "- No goals set";

  const insufficientData = checkins.length < 2;
  const patientNameLine = patientFirstName
    ? `Patient first name (for send_this only): ${patientFirstName}`
    : "Patient first name: unknown";

  // Therapeutic context sections (optional — included when available)
  const modalitiesSection = modalities && modalities.length > 0
    ? `\nTherapeutic context: This therapist works primarily with ${modalities.join(", ")}. Tailor TRY THIS to techniques within these modalities specifically.`
    : "";

  const dsmSection = dsmContext && dsmContext.length > 0
    ? `\nDiagnostic context: Patient is presenting with ${dsmContext.join("; ")}. Use this to inform WATCH FOR and TRY THIS — do not reference diagnostic labels in the output text itself.`
    : "";

  return `You are a clinical co-pilot helping a therapist prepare for their next session.
You will receive de-identified check-in data (ratings and notes), goals (active and completed), and optionally therapist clinical notes.
Your job is to produce a structured JSON summary with 4 actionable cards.

ABSOLUTE RULES:
- NEVER use these words: diagnose, prescribe, disorder, symptom, clinical, treatment plan, medication
- NEVER use DSM diagnostic labels (depression, anxiety disorder, bipolar, PTSD, OCD, etc.)
- NEVER include DSM/ICD codes (e.g. F41.1, F32.1) in the output
- All content must be observational and non-prescriptive
- Be SPECIFIC to this patient's data — never generic
- Do not output the modality labels themselves (e.g. "CBT", "EMDR") — instead describe the specific technique

DATA:
Check-ins (most recent first):
${checkinLines}

Goals:
${goalLines}

${patientNameLine}
${scrubbedClinicalNotes ? `\nTherapist clinical notes: ${scrubbedClinicalNotes}` : ""}
${modalitiesSection}
${dsmSection}

${insufficientData ? `NOTE: Fewer than 2 check-ins exist. Set open_with, watch_for, and try_this to null. Set confidence to "low". You may still generate send_this if goals exist.` : ""}

INSTRUCTIONS FOR EACH FIELD:

rating_trend: Analyze the rating trajectory. Use "improving", "stable", "declining", or "insufficient_data" (if < 2 check-ins).
rating_delta: Numeric difference between most recent and earliest rating, or null if only 1 check-in.
data_source: Brief citation like "from last N check-ins".
confidence: "high" (3+ check-ins), "medium" (2 check-ins), "low" (< 2 check-ins).
flags: Array of string flags (e.g. "declining_trajectory", "critical_score"). Empty array if none.

open_with: One specific opening question for the session. MUST reference something from the patient's recent check-in notes, goals, or clinical notes — never a generic question like "how was your week?". Reference the trend direction when relevant. If a goal was recently completed, consider referencing that win. ${insufficientData ? "Set to null." : ""}

watch_for: One clinical observation to stay alert to during the session. Reference the actual rating trend and score values. If diagnostic context is provided, watch for presentation-specific patterns (e.g. avoidance patterns, catastrophic thinking, withdrawal from committed activities). Observational only — never diagnostic. ${insufficientData ? "Set to null." : ""}

try_this: One concrete technique or intervention for this session. Must name a specific method. If the therapist's modalities are provided, choose a technique from those modalities. If diagnostic context is provided, tailor the technique to the presentation. Never say "consider exploring" without naming the technique. ${insufficientData ? "Set to null." : ""}

send_this: A warm pre-session outreach message written in first person from the therapist. 2-3 sentences max. Must include the patient's first name. Warm and encouraging, never clinical. Reference something specific from check-ins or goals.

Respond with ONLY valid JSON matching this exact schema:
{
  "rating_trend": "improving" | "stable" | "declining" | "insufficient_data",
  "rating_delta": <number or null>,
  "data_source": "string",
  "confidence": "high" | "medium" | "low",
  "flags": [],
  "open_with": "string or null",
  "watch_for": "string or null",
  "try_this": "string or null",
  "send_this": "string or null"
}`;
}

// ── Banned term validation ───────────────────────────────────────────────────

const BANNED_TERMS = [
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

const ALL_BANNED = [...BANNED_TERMS, ...BANNED_THEME_TERMS];

export function validateSessionPrepOutput(output: SessionPrepOutput): string[] {
  const errors: string[] = [];

  // Check all text card fields for banned terms
  const textFields: { name: string; value: string | null }[] = [
    { name: "open_with", value: output.open_with },
    { name: "watch_for", value: output.watch_for },
    { name: "try_this", value: output.try_this },
    { name: "send_this", value: output.send_this },
  ];

  for (const field of textFields) {
    if (!field.value) continue;
    const lower = field.value.toLowerCase();
    for (const term of ALL_BANNED) {
      if (lower.includes(term)) {
        errors.push(`${field.name} contains banned term: "${term}"`);
      }
    }
  }

  return errors;
}

// ── Estimate token count (rough: 1 token ≈ 4 chars) ─────────────────────────

export function estimateTokenCount(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}
