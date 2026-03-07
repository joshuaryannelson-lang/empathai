// __tests__/p1-fixes.test.ts
// Tests for P1 fixes: QA board RLS, portal welcome screen, goal status badges,
// demo page links, portal session reset/expiry.

import * as fs from "fs";
import * as path from "path";

// ═══════════════════════════════════════════════════════════════════
// SUITE 10: QA API routes use supabaseAdmin (bypass RLS)
// ═══════════════════════════════════════════════════════════════════
describe("Suite 10: QA API routes use supabaseAdmin", () => {
  const qaDir = path.resolve(__dirname, "../app/api/qa");

  test("60a. qa/route.ts imports supabaseAdmin, not supabase (anon)", () => {
    const content = fs.readFileSync(path.join(qaDir, "route.ts"), "utf-8");
    expect(content).toContain("supabaseAdmin");
    // Should NOT import the anon client for DB operations
    expect(content).not.toMatch(/import\s*\{[^}]*\bsupabase\b[^A][^}]*\}\s*from/);
  });

  test("60b. qa/verify/route.ts imports supabaseAdmin", () => {
    const content = fs.readFileSync(path.join(qaDir, "verify", "route.ts"), "utf-8");
    expect(content).toContain("supabaseAdmin");
    expect(content).not.toMatch(/import\s*\{[^}]*\bsupabase\b[^A][^}]*\}\s*from/);
  });

  test("60c. qa/mark-stale/route.ts imports supabaseAdmin", () => {
    const content = fs.readFileSync(path.join(qaDir, "mark-stale", "route.ts"), "utf-8");
    expect(content).toContain("supabaseAdmin");
    expect(content).not.toMatch(/import\s*\{[^}]*\bsupabase\b[^A][^}]*\}\s*from/);
  });

  test("60d. all three QA routes use force-dynamic", () => {
    const routes = ["route.ts", "verify/route.ts", "mark-stale/route.ts"];
    for (const route of routes) {
      const content = fs.readFileSync(path.join(qaDir, route), "utf-8");
      expect(content).toContain('export const dynamic = "force-dynamic"');
    }
  });

  test("60e. qa/route.ts has GET, POST, DELETE handlers", () => {
    const content = fs.readFileSync(path.join(qaDir, "route.ts"), "utf-8");
    expect(content).toMatch(/export\s+async\s+function\s+GET/);
    expect(content).toMatch(/export\s+async\s+function\s+POST/);
    expect(content).toMatch(/export\s+async\s+function\s+DELETE/);
  });

  test("60f. qa/verify/route.ts validates check_id and verified_by", () => {
    const content = fs.readFileSync(path.join(qaDir, "verify", "route.ts"), "utf-8");
    expect(content).toContain("check_id");
    expect(content).toContain("verified_by");
    expect(content).toContain('return bad("check_id required")');
  });

  test("60g. qa/mark-stale/route.ts validates page_id", () => {
    const content = fs.readFileSync(path.join(qaDir, "mark-stale", "route.ts"), "utf-8");
    expect(content).toContain("page_id");
    expect(content).toContain('return bad("page_id required")');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 11: Portal Welcome page structure
// ═══════════════════════════════════════════════════════════════════
describe("Suite 11: Portal Welcome page", () => {
  const welcomePath = path.resolve(__dirname, "../app/portal/welcome/page.tsx");

  test("61a. welcome page exists", () => {
    expect(fs.existsSync(welcomePath)).toBe(true);
  });

  test("61b. welcome page uses PortalIdentityContext", () => {
    const content = fs.readFileSync(welcomePath, "utf-8");
    expect(content).toContain("PortalIdentityContext");
  });

  test("61c. welcome page redirects to onboarding when no session", () => {
    const content = fs.readFileSync(welcomePath, "utf-8");
    expect(content).toContain("/portal/onboarding");
  });

  test("61d. welcome page has CTA for check-in", () => {
    const content = fs.readFileSync(welcomePath, "utf-8");
    expect(content).toContain("/portal/checkin");
  });

  test("61e. welcome page has links to history and goals", () => {
    const content = fs.readFileSync(welcomePath, "utf-8");
    expect(content).toContain("/portal/history");
    expect(content).toContain("/portal/goals");
  });

  test("61f. welcome page displays patient first name", () => {
    const content = fs.readFileSync(welcomePath, "utf-8");
    // Uses display_label to extract first name
    expect(content).toContain("display_label");
    expect(content).toContain("Welcome");
  });

  test("61g. welcome page fetches check-ins and goals for status tiles", () => {
    const content = fs.readFileSync(welcomePath, "utf-8");
    expect(content).toContain("/api/cases/");
    expect(content).toContain("/checkins");
    expect(content).toContain("/goals");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 12: Goal status badges (Active/Completed)
// ═══════════════════════════════════════════════════════════════════
describe("Suite 12: Goal status badges", () => {
  const goalsPath = path.resolve(__dirname, "../app/portal/goals/page.tsx");

  test("62a. goals page has Goal type with status field", () => {
    const content = fs.readFileSync(goalsPath, "utf-8");
    // The Goal type should include status
    expect(content).toMatch(/type\s+Goal\s*=\s*\{[^}]*status:\s*string/s);
  });

  test("62b. goals page renders 'Active' badge text", () => {
    const content = fs.readFileSync(goalsPath, "utf-8");
    expect(content).toContain('"Active"');
  });

  test("62c. goals page renders 'Completed' badge text", () => {
    const content = fs.readFileSync(goalsPath, "utf-8");
    expect(content).toContain('"Completed"');
  });

  test("62d. goals page differentiates done vs active status visually", () => {
    const content = fs.readFileSync(goalsPath, "utf-8");
    // Checks for done = "done" || "completed" pattern
    expect(content).toContain('g.status === "done"');
    expect(content).toContain('g.status === "completed"');
  });

  test("62e. goals page shows done count out of total", () => {
    const content = fs.readFileSync(goalsPath, "utf-8");
    expect(content).toContain("doneCount");
    expect(content).toMatch(/doneCount.*\/.*goals\.length/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 13: Demo page links and structure
// ═══════════════════════════════════════════════════════════════════
describe("Suite 13: Demo page links", () => {
  const demoPath = path.resolve(__dirname, "../app/demo/page.tsx");

  test("63a. demo page uses silent auth via enableDemoMode for patient", () => {
    const content = fs.readFileSync(demoPath, "utf-8");
    expect(content).toContain("enableDemoMode");
    expect(content).toContain('"patient"');
  });

  test("63b. demo page uses silent auth for manager persona", () => {
    const content = fs.readFileSync(demoPath, "utf-8");
    expect(content).toContain('"manager"');
    expect(content).toContain("authAsManager");
  });

  test("63c. demo page uses silent auth for therapist persona", () => {
    const content = fs.readFileSync(demoPath, "utf-8");
    expect(content).toContain('"therapist"');
    expect(content).toContain("authAsTherapist");
  });

  test("63d. demo page has mobile responsive styles for persona cards", () => {
    const content = fs.readFileSync(demoPath, "utf-8");
    expect(content).toContain("@media (max-width:");
    // Cascading layout uses indent-scale for responsive behavior
    expect(content).toContain("--indent-scale");
  });

  test("63e. demo page has three persona cards: manager, therapist, patient", () => {
    const content = fs.readFileSync(demoPath, "utf-8");
    expect(content).toContain('"manager"');
    expect(content).toContain('"therapist"');
    expect(content).toContain('"patient"');
  });

  test("63f. demo page imports DEMO_CONFIG from demoMode", () => {
    const content = fs.readFileSync(demoPath, "utf-8");
    expect(content).toContain("DEMO_CONFIG");
    expect(content).toContain("demoMode");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 14: Portal session expiry + reset
// ═══════════════════════════════════════════════════════════════════
describe("Suite 14: Portal session expiry and reset", () => {
  const layoutPath = path.resolve(__dirname, "../app/portal/layout.tsx");
  const onboardingPath = path.resolve(__dirname, "../app/portal/onboarding/page.tsx");

  test("64a. portal layout checks JWT expiry on session restore", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("isTokenExpired");
    expect(content).toContain("payload.exp");
  });

  test("64b. portal layout clears expired tokens from localStorage", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    // When token is expired, should remove it
    expect(content).toContain("localStorage.removeItem");
    expect(content).toContain("isTokenExpired(token)");
  });

  test("64c. onboarding page supports ?fresh=1 to clear session", () => {
    const content = fs.readFileSync(onboardingPath, "utf-8");
    expect(content).toContain('fresh');
    expect(content).toContain("signOut");
  });

  test("64d. onboarding page shows returning user prompt instead of auto-redirect", () => {
    const content = fs.readFileSync(onboardingPath, "utf-8");
    // Should have a 'returning' mode
    expect(content).toContain('"returning"');
    expect(content).toContain("active session");
    expect(content).toContain("Start over");
  });

  test("64e. onboarding page redirects existing sessions to /portal/welcome", () => {
    const content = fs.readFileSync(onboardingPath, "utf-8");
    expect(content).toContain("/portal/welcome");
  });

  test("64f. layout isTokenExpired returns false for empty token (demo mode)", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    // Function should treat empty token as "not expired" (demo mode)
    expect(content).toContain('if (!token) return false');
  });
});
