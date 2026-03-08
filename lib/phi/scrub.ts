// lib/phi/scrub.ts
// PHI scrubbing layer for AI prompts and outputs.
// Wraps lib/services/redaction.ts with last-name heuristic and audit logging.

import {
  scrubPrompt as baseScrubPrompt,
  scrubOutput as baseScrubOutput,
  type RedactedString,
  type SafeOutput,
} from "@/lib/services/redaction";
import { safeLog } from "@/lib/logger";

// ── Last-name heuristic ─────────────────────────────────────────────────────
// Matches "FirstName LastName" where both are capitalized words.
// Replaces the last name only (preserves first name per PHI rules).
const LAST_NAME_RE = /\b([A-Z][a-z]+)\s+([A-Z][a-z]{1,})\b/g;

// Also matches last names as JSON property values: "lastName":"Smith"
// Strips common name-bearing JSON fields
const JSON_LASTNAME_RE = /("(?:last_?[Nn]ame|lastName|patient_last_name|full_?[Nn]ame|fullName)")\s*:\s*"([^"]+)"/g;

// "born in YYYY" pattern
const BORN_IN_RE = /\bborn\s+in\s+\d{4}\b/gi;

function stripLastNames(text: string): { text: string; matched: boolean } {
  let matched = false;

  // First: strip JSON-encoded last name fields
  let result = text.replace(JSON_LASTNAME_RE, (_match, key) => {
    matched = true;
    return `${key}:"[REDACTED]"`;
  });

  // Then: strip natural-language "First Last" patterns
  result = result.replace(LAST_NAME_RE, (_match, first, _last) => {
    matched = true;
    return `${first} [REDACTED]`;
  });
  return { text: result, matched };
}

function stripBornIn(text: string): { text: string; matched: boolean } {
  let matched = false;
  const result = text.replace(BORN_IN_RE, () => {
    matched = true;
    return "[REDACTED]";
  });
  return { text: result, matched };
}

// ── Audit logging ───────────────────────────────────────────────────────────
// Logs that scrubbing occurred WITHOUT logging the original value.

export interface PhiScrubEvent {
  event: "phi_scrub";
  field: string;
  pattern_matched: string;
  route: string;
  timestamp: string;
}

type AuditSink = (entry: PhiScrubEvent) => void;

let auditSink: AuditSink = (entry) => {
  // Default: safe log in structured format
  safeLog.info("[phi_scrub]", { route: entry.route, field: entry.field, pattern: entry.pattern_matched });
};

export function setAuditSink(sink: AuditSink): void {
  auditSink = sink;
}

function logScrubEvents(
  redactions: string[],
  field: string,
  route: string,
): void {
  for (const pattern of redactions) {
    auditSink({
      event: "phi_scrub",
      field,
      pattern_matched: pattern,
      route,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ScrubOptions {
  /** Field name for audit logging */
  field?: string;
  /** Route name for audit logging */
  route?: string;
  /** Known names to redact */
  knownNames?: string[];
}

/**
 * Scrub PHI from text before it enters an AI prompt.
 * Applies last-name heuristic on top of base patterns (email, phone, DOB, SSN, address).
 * Logs PHI_SCRUB_EVENT when patterns match.
 */
export function scrubPrompt(input: string, opts: ScrubOptions = {}): RedactedString {
  const { field = "unknown", route = "unknown", knownNames = [] } = opts;

  // Apply last-name heuristic first
  const lastNameResult = stripLastNames(input);
  const bornInResult = stripBornIn(lastNameResult.text);

  // Apply base scrubbing (email, phone, DOB, SSN, address, known names)
  const base = baseScrubPrompt(bornInResult.text, knownNames);

  // Merge redactions
  const allRedactions = [...base.redactions];
  if (lastNameResult.matched) allRedactions.push("LAST_NAME");
  if (bornInResult.matched) allRedactions.push("BORN_IN");

  // Log events
  if (allRedactions.length > 0) {
    logScrubEvents(allRedactions, field, route);
  }

  return { text: base.text, redactions: allRedactions };
}

/**
 * Scrub PHI from AI output before it reaches the client.
 * Same patterns as scrubPrompt, plus markdown-formatted identifiers.
 */
export function scrubOutput(output: string, opts: ScrubOptions = {}): SafeOutput {
  const { field = "output", route = "unknown", knownNames = [] } = opts;

  // Apply last-name heuristic
  const lastNameResult = stripLastNames(output);
  const bornInResult = stripBornIn(lastNameResult.text);

  // Strip markdown-formatted identifiers that might slip through
  // e.g. **John Smith** or _John Smith_
  let cleaned = bornInResult.text;
  cleaned = cleaned.replace(/\*\*([A-Z][a-z]+)\s+([A-Z][a-z]+)\*\*/g, "**$1 [REDACTED]**");
  cleaned = cleaned.replace(/_([A-Z][a-z]+)\s+([A-Z][a-z]+)_/g, "_$1 [REDACTED]_");

  // Apply base scrubbing
  const base = baseScrubOutput(cleaned, knownNames);

  // Merge redactions
  const allRedactions = [...base.redactions];
  if (lastNameResult.matched) allRedactions.push("LAST_NAME");
  if (bornInResult.matched) allRedactions.push("BORN_IN");

  if (allRedactions.length > 0) {
    logScrubEvents(allRedactions, field, route);
  }

  return {
    text: base.text,
    blocked: base.blocked || lastNameResult.matched || bornInResult.matched,
    redactions: allRedactions,
  };
}
