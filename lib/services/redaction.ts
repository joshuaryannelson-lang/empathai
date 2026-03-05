// lib/services/redaction.ts
// PII redaction service — runs BEFORE data enters a prompt and BEFORE AI output reaches the UI.

export interface RedactedString {
  text: string;
  redactions: string[]; // list of redaction types applied, e.g. ["NAME", "EMAIL"]
}

export interface SafeOutput {
  text: string;
  blocked: boolean;
  redactions: string[];
}

// ── Patterns ────────────────────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
const DOB_RE = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

// US-style street addresses: "123 Main St", "456 Elm Avenue, Apt 7"
const ADDRESS_RE = /\b\d{1,5}\s+[A-Z][a-zA-Z]+(?:\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place|Cir|Circle))\.?(?:\s*,?\s*(?:Apt|Suite|Unit|#)\s*\w+)?/gi;

// Known names list — populated per-call via scrubWithNames
type ReplacementEntry = { pattern: RegExp; tag: string };

function buildNamePatterns(names: string[]): ReplacementEntry[] {
  const entries: ReplacementEntry[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name.length < 2) continue;
    // Escape regex special chars
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    entries.push({
      pattern: new RegExp(`\\b${escaped}\\b`, "gi"),
      tag: "NAME",
    });
  }
  return entries;
}

function applyRedactions(input: string, extraNames: string[] = []): RedactedString {
  const redactions = new Set<string>();
  let text = input;

  // Order matters: SSN before phone (SSN is more specific)
  const staticPatterns: { re: RegExp; tag: string }[] = [
    { re: SSN_RE, tag: "SSN" },
    { re: EMAIL_RE, tag: "EMAIL" },
    { re: PHONE_RE, tag: "PHONE" },
    { re: DOB_RE, tag: "DOB" },
    { re: ADDRESS_RE, tag: "ADDRESS" },
  ];

  for (const { re, tag } of staticPatterns) {
    // Reset lastIndex for global regexes
    re.lastIndex = 0;
    if (re.test(text)) {
      redactions.add(tag);
      re.lastIndex = 0;
      text = text.replace(re, `[${tag}]`);
    }
  }

  // Name patterns from provided list
  const namePatterns = buildNamePatterns(extraNames);
  for (const { pattern, tag } of namePatterns) {
    if (pattern.test(text)) {
      redactions.add(tag);
      text = text.replace(pattern, `[${tag}]`);
    }
  }

  return { text, redactions: Array.from(redactions) };
}

/**
 * Scrub PII from a string before it enters a prompt.
 * Accepts an optional list of known names to redact.
 * Never throws — if unsure, redacts aggressively.
 */
export function scrubPrompt(input: string, knownNames: string[] = []): RedactedString {
  try {
    return applyRedactions(input, knownNames);
  } catch {
    // If anything goes wrong, block the entire input
    return { text: "[REDACTED]", redactions: ["UNKNOWN"] };
  }
}

/**
 * Scrub PII from AI output before it reaches the UI.
 * If unredacted PII is detected, marks output as blocked.
 */
export function scrubOutput(output: string, knownNames: string[] = []): SafeOutput {
  try {
    const result = applyRedactions(output, knownNames);
    return {
      text: result.text,
      blocked: result.redactions.length > 0,
      redactions: result.redactions,
    };
  } catch {
    return { text: "[OUTPUT BLOCKED]", blocked: true, redactions: ["UNKNOWN"] };
  }
}
