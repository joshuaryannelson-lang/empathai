"use client";

// PHI patterns that should be blocked in patient free-text fields.
// This is a client-side guardrail — the API should also enforce this.
const PHI_PATTERNS = [
  { name: "email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: "phone", pattern: /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g },
  { name: "ssn", pattern: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g },
  { name: "address", pattern: /\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place)\b/gi },
];

export type PHIViolation = {
  name: string;
  match: string;
};

/** Check text for PHI patterns. Returns array of violations (empty if clean). */
export function detectPHI(text: string): PHIViolation[] {
  if (!text) return [];
  const violations: PHIViolation[] = [];
  for (const { name, pattern } of PHI_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    const matches = text.match(re);
    if (matches) {
      for (const m of matches) {
        violations.push({ name, match: m });
      }
    }
  }
  return violations;
}

/** Returns a user-friendly warning for PHI violations */
export function phiWarningMessage(violations: PHIViolation[]): string | null {
  if (violations.length === 0) return null;
  const types = [...new Set(violations.map(v => {
    switch (v.name) {
      case "email": return "email addresses";
      case "phone": return "phone numbers";
      case "ssn": return "social security numbers";
      case "address": return "street addresses";
      default: return "personal information";
    }
  }))];
  return `Please don't include ${types.join(" or ")} in your notes. Your care team already has your contact info.`;
}
