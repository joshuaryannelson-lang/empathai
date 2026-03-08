// __tests__/portal-demo-mode.test.ts
// Suite 10: Demo mode detection and API call fixes
// Verifies that portal pages correctly detect demo mode via empty session token
// and append ?demo=true to API calls in demo mode.

import * as fs from "fs";
import * as path from "path";

const portalDir = path.resolve(__dirname, "../app/portal");

// ═══════════════════════════════════════════════════════════════════
// SUITE 10a: Demo mode check-in — empty token detection
// ═══════════════════════════════════════════════════════════════════
describe("Suite 10a: Demo mode check-in — empty token detection", () => {
  const checkinPath = path.join(portalDir, "checkin/page.tsx");
  let checkinContent: string;

  beforeAll(() => {
    checkinContent = fs.readFileSync(checkinPath, "utf-8");
  });

  test("42a. checkin page exists", () => {
    expect(fs.existsSync(checkinPath)).toBe(true);
  });

  test("42b. checkin uses hasRealSession guard (GAP-29)", () => {
    // GAP-29: Demo mode requires explicit demo flag AND no real patient session
    // Pattern: hasRealSession = session != null && !!session.token && !!session.case_code
    expect(checkinContent).toMatch(/hasRealSession/);
    expect(checkinContent).toMatch(/session\.token/);
    expect(checkinContent).toMatch(/session\.case_code/);
  });

  test("42c. checkin detects demo mode via isDemoMode() (localStorage-based)", () => {
    // Demo mode now uses isDemoMode() from demoMode.ts (localStorage flag)
    expect(checkinContent).toMatch(/isDemoMode/);
  });

  test("42d. checkin uses isDemo to gate API calls (no real fetch in demo mode)", () => {
    // In demo mode, the check-in should not make a real API call
    expect(checkinContent).toMatch(/if\s*\(\s*isDemo\s*\)/);
  });

  test("42e. checkin uses AND logic: isDemoMode() && !hasRealSession (GAP-29)", () => {
    // GAP-29: isDemo = isDemoMode() && !hasRealSession
    // A real session always overrides demo mode flags
    const isDemoLine = checkinContent
      .split("\n")
      .find((line) => line.includes("const isDemo") && line.includes("isDemoMode"));
    expect(isDemoLine).toBeDefined();
    // Must use AND to ensure real sessions override demo flags
    expect(isDemoLine).toMatch(/&&/);
    expect(isDemoLine).toMatch(/!hasRealSession/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 10b: Demo patient history — ?demo=true appended to API calls
// ═══════════════════════════════════════════════════════════════════
describe("Suite 10b: Demo patient history — API demo param", () => {
  const historyPath = path.join(portalDir, "history/page.tsx");
  let historyContent: string;

  beforeAll(() => {
    historyContent = fs.readFileSync(historyPath, "utf-8");
  });

  test("43a. history page exists", () => {
    expect(fs.existsSync(historyPath)).toBe(true);
  });

  test("43b. history page computes demoSuffix from isDemoMode() guard (GAP-29)", () => {
    // Pattern: isDemo ? "?demo=true" : "" (hardened isDemoMode + hasRealSession)
    expect(historyContent).toMatch(/isDemo\s*\?\s*["']?\?demo=true["']?/);
    expect(historyContent).toMatch(/isDemoMode\(\)\s*&&\s*!hasRealSession/);
  });

  test("43c. history page appends demoSuffix to timeline API fetch URL", () => {
    // The fetch URL should include demoSuffix variable
    expect(historyContent).toMatch(/\/api\/cases\/.*\/timeline.*demoSuffix/);
  });

  test("43d. history page does NOT display therapist name", () => {
    // Comment or absence of therapist name rendering
    // The fix removed therapist name from patient portal
    expect(historyContent).toMatch(/[Tt]herapist.*not displayed|intentionally not displayed/i);
    // Should NOT have a line setting therapist name state
    expect(historyContent).not.toMatch(/setTherapistName\s*\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 10c: Demo patient goals — ?demo=true appended to API calls
// ═══════════════════════════════════════════════════════════════════
describe("Suite 10c: Demo patient goals — API demo param", () => {
  const goalsPath = path.join(portalDir, "goals/page.tsx");
  let goalsContent: string;

  beforeAll(() => {
    goalsContent = fs.readFileSync(goalsPath, "utf-8");
  });

  test("44a. goals page exists", () => {
    expect(fs.existsSync(goalsPath)).toBe(true);
  });

  test("44b. goals page computes demoSuffix from isDemoMode() guard (GAP-29)", () => {
    // Pattern: isDemo ? "?demo=true" : "" (hardened isDemoMode + hasRealSession)
    expect(goalsContent).toMatch(/isDemo\s*\?\s*["']?\?demo=true["']?/);
    expect(goalsContent).toMatch(/isDemoMode\(\)\s*&&\s*!hasRealSession/);
  });

  test("44c. goals page appends demoSuffix to goals API fetch URL", () => {
    // The fetch URL should include demoSuffix variable
    expect(goalsContent).toMatch(/\/api\/cases\/.*\/goals.*demoSuffix/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 10d: Portal layout — legacy demo session has empty token
// ═══════════════════════════════════════════════════════════════════
describe("Suite 10d: Portal layout — legacy demo session structure", () => {
  const layoutPath = path.join(portalDir, "layout.tsx");
  let layoutContent: string;

  beforeAll(() => {
    layoutContent = fs.readFileSync(layoutPath, "utf-8");
  });

  test("45a. layout sets token to empty string for legacy/demo sessions", () => {
    // In legacy demo mode, token should be "" (empty string)
    // Pattern: token: "" or token: ''
    expect(layoutContent).toMatch(/token:\s*["']["']/);
  });

  test("45b. layout comment documents empty token as demo mode indicator", () => {
    // There should be a comment explaining the empty token pattern
    expect(layoutContent).toMatch(/[Nn]o JWT.*legacy|legacy.*demo/);
  });
});
