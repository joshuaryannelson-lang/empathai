// __tests__/gap-29-demo-guard.test.ts
// GAP-29: Demo persona guard in check-in page
// Verifies that demo mode only activates with explicit demo flag AND no real patient session.

import * as fs from "fs";
import * as path from "path";

const checkinPath = path.resolve(__dirname, "../app/portal/checkin/page.tsx");

// ═══════════════════════════════════════════════════════════════════
// SUITE GAP-29a: Source-level guard verification
// ═══════════════════════════════════════════════════════════════════
describe("GAP-29a: Demo guard source checks", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(checkinPath, "utf-8");
  });

  test("hasRealSession checks for token AND case_code", () => {
    const line = src.split("\n").find((l) => l.includes("hasRealSession"));
    expect(line).toBeDefined();
    expect(line).toMatch(/session\.token/);
    expect(line).toMatch(/session\.case_code/);
  });

  test("isDemo uses isDemoMode() && !hasRealSession (AND, not OR)", () => {
    const line = src
      .split("\n")
      .find((l) => l.includes("const isDemo") && l.includes("isDemoMode"));
    expect(line).toBeDefined();
    expect(line).toMatch(/isDemoMode\(\)\s*&&\s*!hasRealSession/);
    // Must NOT use OR — that was the old bug
    expect(line).not.toMatch(/\|\|/);
  });

  test("demo persona names are only rendered inside isDemo conditionals", () => {
    // "Jordan" is the demo patient name shown in the check-in greeting
    expect(src).toMatch(/Jordan/);

    // Split source at isDemo references — the first section (before any isDemo)
    // should NOT contain demo persona names
    const isDemoSections = src.split("isDemo");
    expect(isDemoSections[0]).not.toMatch(/Jordan/);

    // "Jordan" should appear AFTER an isDemo check
    const beforeFirstJordan = src.substring(0, src.indexOf("Jordan"));
    expect(beforeFirstJordan).toMatch(/isDemo/);

    // Therapist name was removed from checkin page (GAP-61: centralized in demo-fixtures)
    expect(src).not.toMatch(/Dr\. Maya Chen/);
  });

  test("redirect logic still works: !session && !isDemo triggers redirect", () => {
    expect(src).toMatch(/!session\s*&&\s*!isDemo/);
    expect(src).toMatch(/router\.replace.*onboarding/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE GAP-29b: Logic truth-table verification
// ═══════════════════════════════════════════════════════════════════
describe("GAP-29b: Demo guard logic truth table", () => {
  // Replicate the exact guard logic from the component
  function computeIsDemo(
    isDemoModeResult: boolean,
    session: { token: string; case_code: string } | null
  ): boolean {
    const hasRealSession =
      session != null && !!session.token && !!session.case_code;
    return isDemoModeResult && !hasRealSession;
  }

  test("real patient session with ?demo=true does NOT trigger demo content", () => {
    // isDemoMode() returns true (URL has ?demo=true), but session is real
    const result = computeIsDemo(true, {
      token: "eyJ.valid.jwt",
      case_code: "EMP-A3F2B1",
    });
    expect(result).toBe(false);
  });

  test("demo mode with no session DOES trigger demo content", () => {
    // isDemoMode() returns true, no session at all
    const result = computeIsDemo(true, null);
    expect(result).toBe(true);
  });

  test("demo mode with real session (has token + case_code) does NOT trigger demo content", () => {
    const result = computeIsDemo(true, {
      token: "eyJ.valid.jwt",
      case_code: "EMP-X1Y2Z3",
    });
    expect(result).toBe(false);
  });

  test("no demo flag and no session does NOT trigger demo content", () => {
    const result = computeIsDemo(false, null);
    expect(result).toBe(false);
  });

  test("no demo flag with real session does NOT trigger demo content", () => {
    const result = computeIsDemo(false, {
      token: "eyJ.valid.jwt",
      case_code: "EMP-A3F2B1",
    });
    expect(result).toBe(false);
  });

  test("demo mode with legacy session (empty token) DOES trigger demo content", () => {
    // Legacy demo session has empty token — isDemoMode() true + no real session
    const result = computeIsDemo(true, { token: "", case_code: "demo-case" });
    expect(result).toBe(true);
  });

  test("demo mode with session missing case_code DOES trigger demo content", () => {
    // Session exists but case_code is empty — not a real session
    const result = computeIsDemo(true, { token: "", case_code: "" });
    expect(result).toBe(true);
  });

  test("session with token but no case_code is NOT a real session", () => {
    // Edge case: token present but case_code missing
    const result = computeIsDemo(true, { token: "eyJ.jwt", case_code: "" });
    expect(result).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE GAP-29c: History page demo guard verification
// ═══════════════════════════════════════════════════════════════════
describe("GAP-29c: History page demo guard", () => {
  const historyPath = path.resolve(__dirname, "../app/portal/history/page.tsx");
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(historyPath, "utf-8");
  });

  test("imports isDemoMode from lib/demo/demoMode", () => {
    expect(src).toMatch(/import\s*\{[^}]*isDemoMode[^}]*\}\s*from\s*["']@\/lib\/demo\/demoMode["']/);
  });

  test("uses hasRealSession AND isDemoMode() for isDemo (not legacy !session.token)", () => {
    const isDemoLine = src.split("\n").find((l: string) => l.includes("const isDemo") && l.includes("isDemoMode"));
    expect(isDemoLine).toBeDefined();
    expect(isDemoLine).toMatch(/isDemoMode\(\)\s*&&\s*!hasRealSession/);
    // Must not use legacy pattern
    expect(src).not.toMatch(/demoSuffix\s*=\s*!session\.token/);
  });

  test("real patient with ?demo=true does NOT get demo suffix (logic check)", () => {
    // Reuse truth table logic
    function computeIsDemo(isDemoModeResult: boolean, session: { token: string; case_code: string } | null): boolean {
      const hasRealSession = session != null && !!session.token && !!session.case_code;
      return isDemoModeResult && !hasRealSession;
    }
    const result = computeIsDemo(true, { token: "eyJ.valid.jwt", case_code: "EMP-A3F2B1" });
    expect(result).toBe(false);
  });

  test("redirect guard uses !session && !isDemo", () => {
    expect(src).toMatch(/!session\s*&&\s*!isDemo/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE GAP-29d: Goals page demo guard verification
// ═══════════════════════════════════════════════════════════════════
describe("GAP-29d: Goals page demo guard", () => {
  const goalsPath = path.resolve(__dirname, "../app/portal/goals/page.tsx");
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(goalsPath, "utf-8");
  });

  test("imports isDemoMode from lib/demo/demoMode", () => {
    expect(src).toMatch(/import\s*\{[^}]*isDemoMode[^}]*\}\s*from\s*["']@\/lib\/demo\/demoMode["']/);
  });

  test("uses hasRealSession AND isDemoMode() for isDemo (not legacy !session.token)", () => {
    const isDemoLine = src.split("\n").find((l: string) => l.includes("const isDemo") && l.includes("isDemoMode"));
    expect(isDemoLine).toBeDefined();
    expect(isDemoLine).toMatch(/isDemoMode\(\)\s*&&\s*!hasRealSession/);
    // Must not use legacy pattern
    expect(src).not.toMatch(/demoSuffix\s*=\s*!session\.token/);
  });

  test("real patient with ?demo=true does NOT get demo suffix (logic check)", () => {
    function computeIsDemo(isDemoModeResult: boolean, session: { token: string; case_code: string } | null): boolean {
      const hasRealSession = session != null && !!session.token && !!session.case_code;
      return isDemoModeResult && !hasRealSession;
    }
    const result = computeIsDemo(true, { token: "eyJ.valid.jwt", case_code: "EMP-X1Y2Z3" });
    expect(result).toBe(false);
  });

  test("redirect guard uses !session && !isDemo", () => {
    expect(src).toMatch(/!session\s*&&\s*!isDemo/);
  });
});
