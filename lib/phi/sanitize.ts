// lib/phi/sanitize.ts
// Prompt injection sanitizer for user-submitted text fields.

export const MAX_NOTE_LENGTH = 1000;

// Case-insensitive partial matches for known injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /disregard\s+(all\s+)?(previous|above|prior)/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\bjailbreak/i,
  /\byou\s+are\s+now\b/i,
  /\bnew\s+instructions\b/i,
  /\bforget\s+(all\s+)?(previous|above|prior|your)\b/i,
  /\bact\s+as\s+(a\s+)?(?:different|new)\b/i,
  /\boverride\s+(all\s+)?(rules|instructions|constraints)\b/i,
];

// Excessive special characters suggesting injection
const EXCESSIVE_SPECIAL_RE = /[><{}]{3,}|`{4,}/;

export interface SanitizeResult {
  safe: boolean;
  reason: string | null;
}

/**
 * Check user-submitted text for prompt injection patterns.
 * Returns { safe: true } if clean, or { safe: false, reason } if detected.
 * Does NOT log the injected content — caller should log only the event.
 */
export function detectInjection(text: string): SanitizeResult {
  // Length check
  if (text.length > MAX_NOTE_LENGTH) {
    return { safe: false, reason: "exceeds_max_length" };
  }

  // Injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: "injection_pattern" };
    }
  }

  // Excessive special characters
  if (EXCESSIVE_SPECIAL_RE.test(text)) {
    return { safe: false, reason: "excessive_special_chars" };
  }

  return { safe: true, reason: null };
}
