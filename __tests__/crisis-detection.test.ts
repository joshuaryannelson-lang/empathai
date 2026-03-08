// __tests__/crisis-detection.test.ts
// Tests for the canonical crisis language detection module (lib/crisis-detection.ts)

import { detectCrisisLanguage, getCrisisPatterns } from "@/lib/crisis-detection";

describe("detectCrisisLanguage (canonical)", () => {
  // ── Positive cases: should trigger ──

  it("detects 'I want to kill myself'", () => {
    expect(detectCrisisLanguage("I want to kill myself")).toBe(true);
  });

  it("detects 'thinking about suicide'", () => {
    expect(detectCrisisLanguage("thinking about suicide")).toBe(true);
  });

  it("detects 'I want to end it all'", () => {
    expect(detectCrisisLanguage("I want to end it all")).toBe(true);
  });

  it("detects 'I'm going to self-harm'", () => {
    expect(detectCrisisLanguage("I'm going to self-harm")).toBe(true);
  });

  it("detects 'I don't want to be alive'", () => {
    expect(detectCrisisLanguage("I don't want to be alive")).toBe(true);
  });

  it("detects 'better off dead'", () => {
    expect(detectCrisisLanguage("better off dead")).toBe(true);
  });

  it("detects 'I can't go on anymore'", () => {
    expect(detectCrisisLanguage("I can't go on anymore")).toBe(true);
  });

  it("detects 'I don't feel safe'", () => {
    expect(detectCrisisLanguage("I don't feel safe")).toBe(true);
  });

  it("detects 'everything is hopeless'", () => {
    expect(detectCrisisLanguage("everything is hopeless")).toBe(true);
  });

  it("detects 'overdose'", () => {
    expect(detectCrisisLanguage("I might overdose")).toBe(true);
  });

  it("detects 'I'm not safe'", () => {
    expect(detectCrisisLanguage("I'm not safe right now")).toBe(true);
  });

  it("detects 'no reason to live'", () => {
    expect(detectCrisisLanguage("there is no reason to live")).toBe(true);
  });

  it("detects 'I want to die' at end of sentence", () => {
    expect(detectCrisisLanguage("I want to die")).toBe(true);
    expect(detectCrisisLanguage("I want to die.")).toBe(true);
  });

  it("detects 'I want to end my life'", () => {
    expect(detectCrisisLanguage("I want to end my life")).toBe(true);
  });

  it("detects 'suicidal' adjective", () => {
    expect(detectCrisisLanguage("I'm feeling suicidal today")).toBe(true);
  });

  it("detects 'want to hurt myself'", () => {
    expect(detectCrisisLanguage("sometimes I want to hurt myself")).toBe(true);
  });

  it("detects smart-quote variants", () => {
    expect(detectCrisisLanguage("I don\u2019t want to be here anymore")).toBe(true);
    expect(detectCrisisLanguage("I can\u2019t go on like this")).toBe(true);
  });

  // ── Negative cases: should NOT trigger ──

  it("does not flag 'I felt sad this week'", () => {
    expect(detectCrisisLanguage("I felt sad this week")).toBe(false);
  });

  it("does not flag 'I had a hard day'", () => {
    expect(detectCrisisLanguage("I had a hard day")).toBe(false);
  });

  it("does not flag 'feeling down but managing'", () => {
    expect(detectCrisisLanguage("feeling down but managing")).toBe(false);
  });

  it("does not flag 'I miss my old routine'", () => {
    expect(detectCrisisLanguage("I miss my old routine")).toBe(false);
  });

  it("does not flag 'I want to die my hair blonde'", () => {
    expect(detectCrisisLanguage("I want to die my hair blonde")).toBe(false);
  });

  it("does not flag 'I can't go on vacation this year'", () => {
    expect(detectCrisisLanguage("I can't go on vacation this year")).toBe(false);
  });

  it("does not flag 'I hurt my knee yesterday'", () => {
    expect(detectCrisisLanguage("I hurt my knee yesterday")).toBe(false);
  });

  it("does not flag 'This road is not safe'", () => {
    expect(detectCrisisLanguage("This road is not safe")).toBe(false);
  });

  // ── Edge cases ──

  it("returns false for empty string", () => {
    expect(detectCrisisLanguage("")).toBe(false);
  });

  it("returns false for null input", () => {
    expect(detectCrisisLanguage(null as unknown as string)).toBe(false);
  });

  it("returns false for very short input", () => {
    expect(detectCrisisLanguage("hi")).toBe(false);
    expect(detectCrisisLanguage("ok")).toBe(false);
  });
});

describe("getCrisisPatterns", () => {
  it("returns a non-empty array of RegExp", () => {
    const patterns = getCrisisPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });

  it("returns a copy (not the internal array)", () => {
    const a = getCrisisPatterns();
    const b = getCrisisPatterns();
    expect(a).not.toBe(b);
  });
});
