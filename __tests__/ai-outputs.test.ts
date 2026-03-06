// __tests__/ai-outputs.test.ts
// Eval suite for AI outputs: SessionPrep, THS scoring, narrative validation, PHI safety.

import {
  buildSessionPrepPrompt,
  validateSessionPrepOutput,
  estimateTokenCount,
  assertNoPHI,
  type SessionPrepOutput,
  type SessionPrepInput,
} from "@/lib/ai/sessionPrepPrompt";
import { calculateTHS, PATIENT_THS_WEIGHTS } from "@/lib/ai/thsScoring";
import { buildTHSNarrativePrompt, validateNarrative } from "@/lib/ai/thsNarrativePrompt";
import { scrubPrompt } from "@/lib/services/redaction";

// ═══════════════════════════════════════════════════════════════════
// SessionPrep Evals
// ═══════════════════════════════════════════════════════════════════
describe("SessionPrep: Prompt & Output", () => {
  const twoCheckins: SessionPrepInput = {
    checkins: [
      { week_index: 4, rating: 8, notes: "Felt more confident in social settings this week" },
      { week_index: 3, rating: 6, notes: "Struggled with motivation but attended all sessions" },
    ],
    goals: [{ label: "reduce social anxiety", week_index_set: 1 }],
  };

  test("1. Two check-ins [6,8] with goal produces all required fields", () => {
    const prompt = buildSessionPrepPrompt(twoCheckins);
    // Prompt should contain the data
    expect(prompt).toContain("Rating 8/10");
    expect(prompt).toContain("Rating 6/10");
    expect(prompt).toContain("reduce social anxiety");
    // Prompt should request the correct JSON schema
    expect(prompt).toContain("rating_trend");
    expect(prompt).toContain("notable_themes");
    expect(prompt).toContain("suggested_focus");
    expect(prompt).toContain("data_source");

    // Simulate a well-formed output (as if returned by the model)
    const output: SessionPrepOutput = {
      rating_trend: "improving",
      rating_delta: 2,
      notable_themes: [
        "reported increased confidence in social settings",
        "noted difficulty with motivation",
      ],
      suggested_focus: "Explore what contributed to the recent confidence increase",
      data_source: "from last 2 check-ins",
      confidence: "high",
      flags: [],
    };
    const violations = validateSessionPrepOutput(output);
    expect(violations).toEqual([]);
  });

  test("2. Single check-in produces confidence 'low' and trend 'insufficient_data'", () => {
    const input: SessionPrepInput = {
      checkins: [{ week_index: 1, rating: 7, notes: "Feeling okay overall" }],
      goals: [],
    };
    const prompt = buildSessionPrepPrompt(input);
    // The prompt instructs the model to return insufficient_data for <2 checkins
    expect(prompt).toContain("fewer than 2 check-ins");
    expect(prompt).toContain("insufficient_data");
  });

  test("3. suggested_focus rejects all banned clinical language", () => {
    const banned = ["diagnose", "treat", "prescribe", "recommend medication", "clinical", "disorder", "symptom"];
    for (const term of banned) {
      const output: SessionPrepOutput = {
        rating_trend: "stable",
        rating_delta: 0,
        notable_themes: [],
        suggested_focus: `Consider how to ${term} the patient's condition`,
        data_source: "from last 2 check-ins",
        confidence: "medium",
        flags: [],
      };
      const violations = validateSessionPrepOutput(output);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain(term);
    }
  });

  test("4. notable_themes rejects DSM diagnostic labels", () => {
    const dsmTerms = [
      "depression", "anxiety disorder", "bipolar", "schizophrenia", "ptsd",
      "post-traumatic stress disorder", "obsessive-compulsive", "ocd",
      "adhd", "attention deficit", "borderline personality",
      "narcissistic personality", "antisocial personality",
      "generalized anxiety disorder", "major depressive",
      "panic disorder", "agoraphobia", "social anxiety disorder",
      "anorexia", "bulimia", "dissociative",
    ];
    for (const term of dsmTerms) {
      const output: SessionPrepOutput = {
        rating_trend: "stable",
        rating_delta: 0,
        notable_themes: [`Patient shows signs of ${term}`],
        suggested_focus: "Continue exploring recent changes",
        data_source: "from last 2 check-ins",
        confidence: "medium",
        flags: [],
      };
      const violations = validateSessionPrepOutput(output);
      expect(violations.length).toBeGreaterThan(0);
    }
  });

  test("5. notable_themes max 3 enforced", () => {
    const output: SessionPrepOutput = {
      rating_trend: "stable",
      rating_delta: 0,
      notable_themes: ["theme1", "theme2", "theme3", "theme4"],
      suggested_focus: "Explore recent patterns",
      data_source: "from last 3 check-ins",
      confidence: "high",
      flags: [],
    };
    const violations = validateSessionPrepOutput(output);
    expect(violations.some(v => v.includes("max is 3"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// THS Scoring Evals (deterministic)
// ═══════════════════════════════════════════════════════════════════
describe("THS: Deterministic Scoring", () => {
  test("6. THS weights sum to 1.0", () => {
    const sum = PATIENT_THS_WEIGHTS.W + PATIENT_THS_WEIGHTS.S + PATIENT_THS_WEIGHTS.O + PATIENT_THS_WEIGHTS.T;
    expect(sum).toBeCloseTo(1.0);
  });

  test("7. calculateTHS({W:8, S:7, O:9, T:6}) — deterministic", () => {
    const result = calculateTHS({ W: 8, S: 7, O: 9, T: 6 });
    // (0.25*8) + (0.25*7) + (0.35*9) + (0.15*6) = 2 + 1.75 + 3.15 + 0.9 = 7.8
    expect(result.score).toBe(7.8);
    expect(result.confidence).toBe("high");
  });

  test("8. calculateTHS({W:5, S:5, O:5, T:5}) === 5.0", () => {
    const result = calculateTHS({ W: 5, S: 5, O: 5, T: 5 });
    expect(result.score).toBe(5.0);
    expect(result.confidence).toBe("high");
  });

  test("9. calculateTHS with null O returns confidence 'low' or 'medium'", () => {
    const result = calculateTHS({ W: 7, S: 6, O: null, T: 8 });
    // 1 null -> medium
    expect(result.confidence).toBe("medium");
    // O treated as 0: (0.25*7) + (0.25*6) + (0.35*0) + (0.15*8) = 1.75+1.5+0+1.2 = 4.45
    expect(result.score).toBe(4.45);
  });

  test("10. calculateTHS with 3 nulls returns confidence 'low'", () => {
    const result = calculateTHS({ W: 7, S: null, O: null, T: null });
    expect(result.confidence).toBe("low");
  });

  test("11. calculateTHS clamps inputs to 0-10", () => {
    const result = calculateTHS({ W: 15, S: -3, O: 10, T: 10 });
    expect(result.components.W).toBe(10);
    expect(result.components.S).toBe(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test("12. calculateTHS all zeros === 0", () => {
    const result = calculateTHS({ W: 0, S: 0, O: 0, T: 0 });
    expect(result.score).toBe(0);
    expect(result.confidence).toBe("high");
  });

  test("13. calculateTHS all tens === 10", () => {
    const result = calculateTHS({ W: 10, S: 10, O: 10, T: 10 });
    expect(result.score).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// THS Narrative Evals
// ═══════════════════════════════════════════════════════════════════
describe("THS: Narrative Validation", () => {
  test("14. Narrative prompt does not contain identifiers", () => {
    const result = calculateTHS({ W: 8, S: 7, O: 9, T: 6 });
    const prompt = buildTHSNarrativePrompt(result, 4);
    expect(prompt).not.toMatch(/patient.name|case_code|john|jane|smith/i);
    expect(prompt).toContain("Week 4");
    expect(prompt).toContain("8/10"); // W component
  });

  test("15. Narrative with banned terms is caught by validateNarrative", () => {
    const bad_narratives = [
      "The patient may have a disorder requiring treatment.",
      "Consider prescribing medication for the symptom cluster.",
      "This clinical presentation suggests a need to diagnose.",
    ];
    for (const narrative of bad_narratives) {
      const violations = validateNarrative(narrative);
      expect(violations.length).toBeGreaterThan(0);
    }
  });

  test("16. Clean narrative passes validation", () => {
    const good = "This week's score reflects steady check-in ratings with strong goal progress. Session engagement was the primary driver.";
    expect(validateNarrative(good)).toEqual([]);
  });

  test("17. Narrative with >3 sentences is flagged", () => {
    const long = "Sentence one. Sentence two. Sentence three. Sentence four.";
    const violations = validateNarrative(long);
    expect(violations.some(v => v.includes("sentences"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Budget Eval
// ═══════════════════════════════════════════════════════════════════
describe("Budget: Token Estimation", () => {
  test("18. Typical SessionPrep prompt < 500 estimated input tokens", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_index: 4, rating: 8, notes: "Had a productive week, spent time with friends and family" },
        { week_index: 3, rating: 6, notes: "Struggled with sleep but managed daily tasks" },
        { week_index: 2, rating: 5, notes: "Felt overwhelmed by work responsibilities" },
      ],
      goals: [
        { label: "improve sleep habits" },
        { label: "build social connections" },
      ],
    };
    const prompt = buildSessionPrepPrompt(input);
    const tokens = estimateTokenCount(prompt);
    expect(tokens).toBeLessThan(500);
  });

  test("19. THS narrative prompt < 300 estimated input tokens", () => {
    const result = calculateTHS({ W: 7, S: 6, O: 8, T: 5 });
    const prompt = buildTHSNarrativePrompt(result, 5);
    const tokens = estimateTokenCount(prompt);
    expect(tokens).toBeLessThan(300);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PHI Safety: Redaction Layer Audit
// ═══════════════════════════════════════════════════════════════════
describe("PHI Safety: Prompt Redaction", () => {
  test("20. Notes with email are scrubbed before entering prompt", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_index: 1, rating: 7, notes: "Contact me at jane@example.com for scheduling" },
        { week_index: 2, rating: 8, notes: "Feeling better this week" },
      ],
      goals: [],
    };
    // buildSessionPrepPrompt internally calls scrubPrompt, then assertNoPHI
    // The email should be replaced with [EMAIL] by scrubPrompt, making assertNoPHI pass
    const prompt = buildSessionPrepPrompt(input);
    expect(prompt).not.toContain("jane@example.com");
    expect(prompt).toContain("[EMAIL]");
  });

  test("21. Notes with phone number are scrubbed before entering prompt", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_index: 1, rating: 6, notes: "Call me at 555-123-4567" },
        { week_index: 2, rating: 7, notes: "Good week overall" },
      ],
      goals: [],
    };
    const prompt = buildSessionPrepPrompt(input);
    expect(prompt).not.toContain("555-123-4567");
    expect(prompt).toContain("[PHONE]");
  });

  test("22. Notes with SSN are scrubbed before entering prompt", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_index: 1, rating: 5, notes: "My SSN is 123-45-6789 for the insurance form" },
        { week_index: 2, rating: 6, notes: "Doing okay" },
      ],
      goals: [],
    };
    const prompt = buildSessionPrepPrompt(input);
    expect(prompt).not.toContain("123-45-6789");
  });

  test("23. assertNoPHI throws on email", () => {
    expect(() => assertNoPHI("send to john@test.com")).toThrow("PHI detected");
  });

  test("24. assertNoPHI throws on phone", () => {
    expect(() => assertNoPHI("call 555-123-4567")).toThrow("PHI detected");
  });

  test("25. assertNoPHI passes on clean text", () => {
    expect(() => assertNoPHI("Felt better this week, rating improved")).not.toThrow();
  });

  test("26. Prompt never contains case_code or patient name", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_index: 1, rating: 7, notes: "Good progress this week" },
        { week_index: 2, rating: 8, notes: "Continuing to improve" },
      ],
      goals: [{ label: "improve daily routine" }],
    };
    const prompt = buildSessionPrepPrompt(input);
    // Prompt should not contain any identifier-like patterns
    expect(prompt).not.toMatch(/case_code/);
    expect(prompt).not.toMatch(/patient_id/);
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // UUID fragment
  });
});
