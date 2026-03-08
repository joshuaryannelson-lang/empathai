// lib/crisis-detection.ts
// Canonical crisis language detection — single source of truth.
// Merges patterns from lib/services/risk.ts and CrisisBanner.tsx.
// This module must be pure (no side effects) and usable in both server and client contexts.

const CRISIS_PATTERNS: RegExp[] = [
  // Suicidal ideation (covers: suicidal, suicide, suicid*)
  /\bsuicid/i,
  // Kill self / hurt self / harm self
  /\b(kill|hurt|harm)(?:ing)?\s*(my|him|her|them)?self\b/i,
  // Self-harm (hyphenated or spaced)
  /\bself[\s-]?harm\b/i,
  // "want to die" — but NOT "want to die my hair" (require end-of-string, punctuation, or "myself")
  /\bwant\s*to\s*die(\s*$|\s*[.!?,;]|\s+myself)/im,
  // "end my life / end it all / end things / end everything"
  /\bend\s*(my\s*life|it\s*all|things|everything)\b/i,
  // "don't want to live / be alive / be here / go on"
  /\bdon[''\u2019]?t\s*want\s*to\s*(live|be\s*alive|be\s*here|go\s*on)\b/i,
  // "no reason to live / no point to live / no reason in living"
  /\bno\s*(point|reason)\s*(to|in)\s*(live|living|go\s*on)\b/i,
  // Hopeless
  /\bhopeless\b/i,
  // Overdose
  /\boverdose\b/i,
  // "better off dead"
  /\bbetter\s*off\s*dead\b/i,
  // "can't go on" — but NOT "can't go on vacation/the trip/etc."
  // Only match when followed by end-of-string, punctuation, "anymore", or "like this"/"living"
  /\bcan[''\u2019]?t\s*go\s*on(\b\s*$|\s*[.!?,;]|\s+(anymore|like\s*this|living))/im,
  // "I'm not safe / I don't feel safe / I feel unsafe / I am not safe" (self-referential only)
  /\bi[''\u2019]?m\s+not\s+safe\b/i,
  /\bi\s+don[''\u2019]?t\s+feel\s+safe\b/i,
  /\bi\s+feel\s+unsafe\b/i,
  /\bi\s+am\s+not\s+safe\b/i,
];

/**
 * Detect crisis language in free-text input.
 * Returns true if any crisis pattern matches.
 */
export function detectCrisisLanguage(text: string): boolean {
  if (!text || typeof text !== "string" || text.length < 5) return false;
  return CRISIS_PATTERNS.some(re => re.test(text));
}

/**
 * Returns the list of crisis patterns for testing purposes.
 */
export function getCrisisPatterns(): RegExp[] {
  return [...CRISIS_PATTERNS];
}
