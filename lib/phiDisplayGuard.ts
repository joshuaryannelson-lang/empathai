// lib/phiDisplayGuard.ts
// Runtime guard: prevents PHI from being rendered in AI-generated display text.
// Call before rendering any AI output to the DOM.

const PHI_PATTERNS = [
  { name: "email", pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: "phone", pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/ },
  { name: "dob", pattern: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/ },
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "address", pattern: /\b\d{1,5}\s+[A-Z][a-zA-Z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane)\b/i },
];

export function assertNoPhiInDisplay(text: string, context: string): void {
  for (const { name, pattern } of PHI_PATTERNS) {
    if (pattern.test(text)) {
      console.error(`PHI detected in display output [${context}]: ${name} pattern matched`);
      throw new Error(`PHI detected in display output [${context}]`);
    }
  }
}

const BANNED_CLINICAL_TERMS = [
  "depression", "anxiety disorder", "bipolar", "schizophrenia", "ptsd",
  "post-traumatic stress disorder", "obsessive-compulsive", "ocd",
  "adhd", "attention deficit", "borderline personality",
  "narcissistic personality", "antisocial personality",
  "generalized anxiety disorder", "major depressive",
  "panic disorder", "agoraphobia", "social anxiety disorder",
  "anorexia", "bulimia", "dissociative",
  "diagnose", "diagnosis", "treatment plan", "clinical recommendation",
  "prescribe", "medication", "disorder", "symptom",
];

export function containsBannedClinicalTerm(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_CLINICAL_TERMS.some(term => lower.includes(term));
}

export function safeDisplayText(text: string, context: string): string {
  try {
    assertNoPhiInDisplay(text, context);
    return text;
  } catch {
    return "[content unavailable]";
  }
}
