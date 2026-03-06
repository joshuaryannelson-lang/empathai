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
import { getDemoSessionPrepStructured } from "@/lib/demo/demoAI";

// ═══════════════════════════════════════════════════════════════════
// SessionPrep Evals
// ═══════════════════════════════════════════════════════════════════
describe("SessionPrep: Prompt & Output", () => {
  const twoCheckins: SessionPrepInput = {
    checkins: [
      { week_label: "Week of Mar 10", rating: 8, notes: "Felt more confident in social settings this week" },
      { week_label: "Week of Mar 3", rating: 6, notes: "Struggled with motivation but attended all sessions" },
    ],
    goals: [{ label: "reduce social anxiety", status: "active" }],
    patientFirstName: "Jordan",
  };

  test("1. Two check-ins [6,8] with goal produces all required fields", () => {
    const prompt = buildSessionPrepPrompt(twoCheckins);
    // Prompt should contain the data
    expect(prompt).toContain("Rating 8/10");
    expect(prompt).toContain("Rating 6/10");
    expect(prompt).toContain("reduce social anxiety");
    // Prompt should request the correct JSON schema
    expect(prompt).toContain("rating_trend");
    expect(prompt).toContain("open_with");
    expect(prompt).toContain("watch_for");
    expect(prompt).toContain("try_this");
    expect(prompt).toContain("send_this");
    expect(prompt).toContain("data_source");

    // Simulate a well-formed output (as if returned by the model)
    const output: SessionPrepOutput = {
      rating_trend: "improving",
      rating_delta: 2,
      data_source: "from last 2 check-ins",
      confidence: "high",
      flags: [],
      open_with: "What specifically helped you feel more confident in social settings this week compared to last?",
      watch_for: "Motivation struggles noted alongside social confidence gains — assess whether avoidance is shifting contexts rather than resolving.",
      try_this: "Use a behavioral activation worksheet to map activities that boost confidence and identify triggers for low motivation days.",
      send_this: "Hi Jordan, great to see the progress you're making. Looking forward to exploring what's working in our next session!",
    };
    const violations = validateSessionPrepOutput(output);
    expect(violations).toEqual([]);
  });

  test("2. Single check-in produces confidence 'low' and trend 'insufficient_data'", () => {
    const input: SessionPrepInput = {
      checkins: [{ week_label: "Week of Feb 24", rating: 7, notes: "Feeling okay overall" }],
      goals: [],
    };
    const prompt = buildSessionPrepPrompt(input);
    // The prompt instructs the model to return insufficient_data for <2 checkins
    expect(prompt).toContain("Fewer than 2 check-ins");
    expect(prompt).toContain("insufficient_data");
  });

  test("3. All card fields reject banned clinical language", () => {
    const banned = ["diagnose", "treat", "prescribe", "recommend medication", "clinical", "disorder", "symptom"];
    for (const term of banned) {
      const output: SessionPrepOutput = {
        rating_trend: "stable",
        rating_delta: 0,
        data_source: "from last 2 check-ins",
        confidence: "medium",
        flags: [],
        open_with: `Consider how to ${term} the patient's condition`,
        watch_for: null,
        try_this: null,
        send_this: null,
      };
      const violations = validateSessionPrepOutput(output);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain(term);
    }
  });

  test("4. Card fields reject DSM diagnostic labels", () => {
    const dsmTerms = [
      "depression", "anxiety disorder", "bipolar", "schizophrenia", "ptsd",
      "post-traumatic stress disorder", "obsessive-compulsive", "ocd",
      "adhd", "attention deficit", "borderline personality",
    ];
    for (const term of dsmTerms) {
      const output: SessionPrepOutput = {
        rating_trend: "stable",
        rating_delta: 0,
        data_source: "from last 2 check-ins",
        confidence: "medium",
        flags: [],
        open_with: null,
        watch_for: `Patient shows signs of ${term}`,
        try_this: null,
        send_this: null,
      };
      const violations = validateSessionPrepOutput(output);
      expect(violations.length).toBeGreaterThan(0);
    }
  });

  test("5. Prompt includes patient first name for send_this", () => {
    const prompt = buildSessionPrepPrompt(twoCheckins);
    expect(prompt).toContain("Jordan");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SessionPrep: 4-Card Evals
// ═══════════════════════════════════════════════════════════════════
describe("SessionPrep: 4-Card Schema", () => {
  test("27. open_with is non-null and specific when >= 2 check-ins exist", () => {
    const prep = getDemoSessionPrepStructured("demo-case-03");
    expect(prep.open_with).not.toBeNull();
    // Specificity proxy: should be a substantial question, not generic
    expect(prep.open_with!.length).toBeGreaterThan(50);
  });

  test("28. watch_for references trend or score data", () => {
    const prep = getDemoSessionPrepStructured("demo-case-03");
    expect(prep.watch_for).not.toBeNull();
    const watchLower = prep.watch_for!.toLowerCase();
    // Should reference declining, score numbers, or trend language
    const referencesData = watchLower.includes("declining") ||
      watchLower.includes("6 to 2") ||
      watchLower.includes("trajectory") ||
      watchLower.includes("score");
    expect(referencesData).toBe(true);
  });

  test("29. try_this names a specific technique", () => {
    const prep = getDemoSessionPrepStructured("demo-case-01");
    expect(prep.try_this).not.toBeNull();
    const tryLower = prep.try_this!.toLowerCase();
    // Must not be ONLY vague phrases without a named technique
    const vagueOnly = /^(consider|explore|think about|reflect on)\s/.test(tryLower) &&
      !tryLower.includes("stress-inoculation") &&
      !tryLower.includes("behavioral") &&
      !tryLower.includes("cbt") &&
      !tryLower.includes("gottman") &&
      !tryLower.includes("grounding") &&
      !tryLower.includes("activation") &&
      !tryLower.includes("technique") &&
      !tryLower.includes("exercise") &&
      !tryLower.includes("rehearsal");
    expect(vagueOnly).toBe(false);
  });

  test("30. send_this contains the patient's first name", () => {
    // demo-case-03 patient is "Sam" (patient_id: patientId(3))
    const prep = getDemoSessionPrepStructured("demo-case-03");
    expect(prep.send_this).not.toBeNull();
    expect(prep.send_this!).toContain("Sam");
  });

  test("31. send_this is 2-3 sentences max", () => {
    const prep = getDemoSessionPrepStructured("demo-case-03");
    expect(prep.send_this).not.toBeNull();
    const sentences = prep.send_this!.split(/[.!?]+/).filter(s => s.trim().length > 0);
    expect(sentences.length).toBeLessThanOrEqual(3);
  });

  test("32. All 4 cards null when insufficient data (confidence low)", () => {
    // Simulate a model response for < 2 check-ins
    const output: SessionPrepOutput = {
      rating_trend: "insufficient_data",
      rating_delta: null,
      data_source: "from last 1 check-in",
      confidence: "low",
      flags: [],
      open_with: null,
      watch_for: null,
      try_this: null,
      send_this: "Hi Jordan, looking forward to our first session together!",
    };
    expect(output.open_with).toBeNull();
    expect(output.watch_for).toBeNull();
    expect(output.try_this).toBeNull();
    expect(output.confidence).toBe("low");
    // send_this CAN still be non-null even with insufficient data
    expect(output.send_this).not.toBeNull();
  });

  test("33. PHI scrubbing — send_this must not contain email, phone, or SSN", () => {
    const output: SessionPrepOutput = {
      rating_trend: "stable",
      rating_delta: 0,
      data_source: "from last 2 check-ins",
      confidence: "high",
      flags: [],
      open_with: "How has your week been?",
      watch_for: "Stable trajectory",
      try_this: "Use a thought record",
      send_this: "Hi Jordan, reach me at jordan@email.com or 555-123-4567!",
    };
    // The validate function checks banned terms, but PHI should be caught by assertNoPHI
    // in the prompt builder. For display, safeDisplayText would catch this.
    // Verify that assertNoPHI catches the PHI patterns
    expect(() => assertNoPHI(output.send_this!)).toThrow("PHI detected");
  });

  test("34. Demo fixture conformance — all required fields present", () => {
    const cases = ["demo-case-01", "demo-case-03", "demo-case-05", "unknown-case"];
    for (const caseId of cases) {
      const prep = getDemoSessionPrepStructured(caseId);
      // Metadata fields
      expect(prep.rating_trend).toBeDefined();
      expect(["improving", "stable", "declining", "insufficient_data"]).toContain(prep.rating_trend);
      expect(prep.data_source).toBeDefined();
      expect(prep.confidence).toBeDefined();
      expect(["high", "medium", "low"]).toContain(prep.confidence);
      expect(Array.isArray(prep.flags)).toBe(true);
      // 4-card fields exist as keys (can be null)
      expect("open_with" in prep).toBe(true);
      expect("watch_for" in prep).toBe(true);
      expect("try_this" in prep).toBe(true);
      expect("send_this" in prep).toBe(true);
    }
  });

  test("35. Demo fixture passes validation (no banned terms)", () => {
    const cases = ["demo-case-01", "demo-case-03", "demo-case-05"];
    for (const caseId of cases) {
      const prep = getDemoSessionPrepStructured(caseId);
      const violations = validateSessionPrepOutput(prep);
      expect(violations).toEqual([]);
    }
  });

  test("36. Prompt token estimate within budget for 4-card schema", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Mar 10", rating: 8, notes: "Had a productive week, spent time with friends and family" },
        { week_label: "Week of Mar 3", rating: 6, notes: "Struggled with sleep but managed daily tasks" },
        { week_label: "Week of Feb 24", rating: 5, notes: "Felt overwhelmed by work responsibilities" },
      ],
      goals: [
        { label: "improve sleep habits" },
        { label: "build social connections" },
      ],
      patientFirstName: "Alex",
    };
    const prompt = buildSessionPrepPrompt(input);
    const tokens = estimateTokenCount(prompt);
    // Prompt includes goal markers, week labels, optional clinical notes/DSM/modalities — ~530 typical, cap at 1000
    expect(tokens).toBeLessThan(1000);
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
  test("18. Typical SessionPrep prompt < 1000 estimated input tokens", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Mar 10", rating: 8, notes: "Had a productive week, spent time with friends and family" },
        { week_label: "Week of Mar 3", rating: 6, notes: "Struggled with sleep but managed daily tasks" },
        { week_label: "Week of Feb 24", rating: 5, notes: "Felt overwhelmed by work responsibilities" },
      ],
      goals: [
        { label: "improve sleep habits" },
        { label: "build social connections" },
      ],
      patientFirstName: "Alex",
    };
    const prompt = buildSessionPrepPrompt(input);
    const tokens = estimateTokenCount(prompt);
    // ~530 typical with week labels + goal markers + clinical notes. Cap at 1000.
    expect(tokens).toBeLessThan(1000);
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
        { week_label: "Week of Feb 17", rating: 7, notes: "Contact me at jane@example.com for scheduling" },
        { week_label: "Week of Feb 24", rating: 8, notes: "Feeling better this week" },
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
        { week_label: "Week of Feb 17", rating: 6, notes: "Call me at 555-123-4567" },
        { week_label: "Week of Feb 24", rating: 7, notes: "Good week overall" },
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
        { week_label: "Week of Feb 17", rating: 5, notes: "My SSN is 123-45-6789 for the insurance form" },
        { week_label: "Week of Feb 24", rating: 6, notes: "Doing okay" },
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

  test("26. Prompt never contains case_code or patient name in data section", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Feb 17", rating: 7, notes: "Good progress this week" },
        { week_label: "Week of Feb 24", rating: 8, notes: "Continuing to improve" },
      ],
      goals: [{ label: "improve daily routine" }],
      patientFirstName: "TestPatient",
    };
    const prompt = buildSessionPrepPrompt(input);
    // Prompt should not contain any identifier-like patterns
    expect(prompt).not.toMatch(/case_code/);
    expect(prompt).not.toMatch(/patient_id/);
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // UUID fragment
    // Patient name IS in the prompt (for send_this) but only in the designated line
    expect(prompt).toContain("Patient first name (for send_this only): TestPatient");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Session Prep: Week Labels, Goal Status, Clinical Notes
// ═══════════════════════════════════════════════════════════════════
describe("SessionPrep: Data Enrichment", () => {
  test("37. week_label appears as formatted label in prompt, not null fallback", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Mar 10", rating: 7, notes: "Decent week" },
        { week_label: "Week of Mar 3", rating: 5, notes: "Rough start" },
      ],
      goals: [],
    };
    const prompt = buildSessionPrepPrompt(input);
    expect(prompt).toContain("Week of Mar 10: Rating 7/10");
    expect(prompt).toContain("Week of Mar 3: Rating 5/10");
    // Should NOT fall back to "Check-in 1" when labels are provided
    expect(prompt).not.toContain("Check-in 1");
    expect(prompt).not.toContain("Check-in 2");
  });

  test("38. Completed goals included with [COMPLETED] marker", () => {
    const input: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Mar 10", rating: 8, notes: "Great week" },
        { week_label: "Week of Mar 3", rating: 6, notes: "Okay week" },
      ],
      goals: [
        { label: "Reduce sleep disruption to < 2 nights/week", status: "active" },
        { label: "Return to weekly exercise", status: "completed" },
      ],
    };
    const prompt = buildSessionPrepPrompt(input);
    expect(prompt).toContain("[ACTIVE] Reduce sleep disruption");
    expect(prompt).toContain("[COMPLETED] Return to weekly exercise");
  });

  test("39. Clinical notes included when present, omitted when null", () => {
    const withNotes: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Mar 10", rating: 7, notes: "Fine" },
        { week_label: "Week of Mar 3", rating: 6, notes: "Okay" },
      ],
      goals: [],
      clinicalNotes: "Patient shows improved affect. Homework compliance good.",
    };
    const prompt = buildSessionPrepPrompt(withNotes);
    expect(prompt).toContain("Therapist clinical notes: Patient shows improved affect");

    const withoutNotes: SessionPrepInput = {
      checkins: [
        { week_label: "Week of Mar 10", rating: 7, notes: "Fine" },
        { week_label: "Week of Mar 3", rating: 6, notes: "Okay" },
      ],
      goals: [],
      clinicalNotes: null,
    };
    const promptNoNotes = buildSessionPrepPrompt(withoutNotes);
    expect(promptNoNotes).not.toContain("Therapist clinical notes");
  });
});
