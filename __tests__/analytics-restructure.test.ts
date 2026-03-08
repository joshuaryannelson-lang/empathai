// __tests__/analytics-restructure.test.ts
// Sprint L-4: Analytics index + sub-page architecture tests

import * as fs from "fs";
import * as path from "path";
import { checkMfaGate } from "@/lib/mfaGuard";

const analyticsDir = path.resolve(__dirname, "../app/analytics");

// ═══════════════════════════════════════════════════════════════════
// SUITE 1: /analytics index page
// ═══════════════════════════════════════════════════════════════════
describe("Analytics index page", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(path.join(analyticsDir, "page.tsx"), "utf-8");
  });

  test("LIVE cards have href links to sub-routes", () => {
    expect(src).toContain('href="/analytics/health-score"');
    expect(src).toContain('href="/analytics/engagement"');
  });

  test("LIVE cards use LiveModuleCard which wraps in Link", () => {
    expect(src).toContain("LiveModuleCard");
    // LiveModuleCard should accept href
    const liveCardDef = src.includes("function LiveModuleCard");
    expect(liveCardDef).toBe(true);
    // Check it uses Link
    expect(src).toContain("<Link href={href}");
  });

  test("COMING SOON cards use ComingSoonModuleCard (non-clickable)", () => {
    const comingSoonMatches = src.match(/ComingSoonModuleCard/g);
    expect(comingSoonMatches).not.toBeNull();
    expect(comingSoonMatches!.length).toBeGreaterThanOrEqual(2);
  });

  test("COMING SOON cards have opacity 0.5", () => {
    // ComingSoonModuleCard should have opacity: 0.5
    const comingSoonDef = src.slice(src.indexOf("function ComingSoonModuleCard"));
    expect(comingSoonDef).toContain("opacity: 0.5");
  });

  test("COMING SOON cards do NOT contain Link or href", () => {
    // Extract just the ComingSoonModuleCard function
    const startIdx = src.indexOf("function ComingSoonModuleCard");
    const endIdx = src.indexOf("\n}", startIdx) + 2;
    const comingSoonFn = src.slice(startIdx, endIdx);
    expect(comingSoonFn).not.toContain("<Link");
    expect(comingSoonFn).not.toContain("href=");
  });

  test("no inline EngagementModule component on index page", () => {
    expect(src).not.toContain("import EngagementModule");
    expect(src).not.toContain("<EngagementModule");
  });

  test("no inline chart or stat content below cards", () => {
    // The old page had a "Patient Engagement" section with EngagementModule
    expect(src).not.toContain("Check-ins per week");
    expect(src).not.toContain("MiniLineChart");
  });

  test("roadmap bar is preserved", () => {
    expect(src).toContain("Module roadmap");
    expect(src).toContain("Health score pipeline is live");
    // "2 of 4 live" is rendered dynamically via {liveModuleCount} of {totalModuleCount}
    expect(src).toContain("liveModuleCount = 2");
    expect(src).toContain("totalModuleCount = 4");
  });

  test("hero heading is preserved", () => {
    expect(src).toContain("Practice insights, powered by real data.");
  });

  test("engagement card shows real data preview", () => {
    expect(src).toContain("EngagementPreview");
    expect(src).toContain("/api/analytics/engagement");
  });

  test("LIVE cards have hover state class", () => {
    expect(src).toContain("analytics-live-card");
    expect(src).toContain(".analytics-live-card:hover");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 2: /analytics/health-score page
// ═══════════════════════════════════════════════════════════════════
describe("/analytics/health-score page", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(path.join(analyticsDir, "health-score/page.tsx"), "utf-8");
  });

  test("page file exists", () => {
    expect(fs.existsSync(path.join(analyticsDir, "health-score/page.tsx"))).toBe(true);
  });

  test("renders back link to /analytics", () => {
    expect(src).toContain('href="/analytics"');
    expect(src).toContain("Back to Analytics");
  });

  test("page title is Practice Health Score", () => {
    expect(src).toContain("Practice Health Score");
  });

  test("has LIVE status badge", () => {
    expect(src).toContain('status="live"');
  });

  test("fetches THS data from API", () => {
    expect(src).toContain("/api/practices/");
    expect(src).toContain("/ths?");
  });

  test("shows THS components (workload, satisfaction, outcomes, stability)", () => {
    expect(src).toContain('"workload"');
    expect(src).toContain('"satisfaction"');
    expect(src).toContain('"outcomes"');
    expect(src).toContain('"stability"');
  });

  test("shows movements section", () => {
    expect(src).toContain("What moved THS this week");
  });

  test("shows recommendations section", () => {
    expect(src).toContain("Recommended actions this week");
  });

  test("no patient names — uses case codes only", () => {
    expect(src).not.toContain("patient_name");
    expect(src).not.toContain("last_name");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 3: /analytics/engagement page
// ═══════════════════════════════════════════════════════════════════
describe("/analytics/engagement page", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(path.join(analyticsDir, "engagement/page.tsx"), "utf-8");
  });

  test("page file exists", () => {
    expect(fs.existsSync(path.join(analyticsDir, "engagement/page.tsx"))).toBe(true);
  });

  test("renders back link to /analytics", () => {
    expect(src).toContain('href="/analytics"');
    expect(src).toContain("Back to Analytics");
  });

  test("page title is Patient Engagement", () => {
    expect(src).toContain("Patient Engagement");
  });

  test("has LIVE status badge", () => {
    expect(src).toContain('status="live"');
  });

  test("fetches engagement data from API", () => {
    expect(src).toContain("/api/analytics/engagement");
  });

  test("shows stat cards (avg weekly, highest week, avg mood)", () => {
    expect(src).toContain("Avg weekly check-ins");
    expect(src).toContain("Highest week");
    expect(src).toContain("Avg mood score");
  });

  test("has manual refresh button", () => {
    expect(src).toContain("Refresh");
    expect(src).toContain("fetchData");
  });

  test("no patient names in response (aggregate data only)", () => {
    expect(src).not.toContain("patient_name");
    expect(src).not.toContain("last_name");
    expect(src).not.toContain("first_name");
  });

  test("shows check-ins per week chart", () => {
    expect(src).toContain("Check-ins per week");
    expect(src).toContain("MiniLineChart");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 4: /analytics/at-risk stub
// ═══════════════════════════════════════════════════════════════════
describe("/analytics/at-risk stub page", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(path.join(analyticsDir, "at-risk/page.tsx"), "utf-8");
  });

  test("page file exists", () => {
    expect(fs.existsSync(path.join(analyticsDir, "at-risk/page.tsx"))).toBe(true);
  });

  test("renders back link to /analytics", () => {
    expect(src).toContain('href="/analytics"');
    expect(src).toContain("Back to Analytics");
  });

  test("page title is At-Risk Pattern Detection", () => {
    expect(src).toContain("At-Risk Pattern Detection");
  });

  test("has COMING SOON badge", () => {
    expect(src).toContain("Coming soon");
  });

  test("shows development message", () => {
    expect(src).toContain("This module is in development");
  });

  test("no chart or fake data", () => {
    expect(src).not.toContain("MiniLineChart");
    expect(src).not.toContain("Sparkline");
    expect(src).not.toContain("StatCard");
    expect(src).not.toContain("fetch(");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 5: /analytics/utilization stub
// ═══════════════════════════════════════════════════════════════════
describe("/analytics/utilization stub page", () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(path.join(analyticsDir, "utilization/page.tsx"), "utf-8");
  });

  test("page file exists", () => {
    expect(fs.existsSync(path.join(analyticsDir, "utilization/page.tsx"))).toBe(true);
  });

  test("renders back link to /analytics", () => {
    expect(src).toContain('href="/analytics"');
    expect(src).toContain("Back to Analytics");
  });

  test("page title is Therapist Utilization", () => {
    expect(src).toContain("Therapist Utilization");
  });

  test("has COMING SOON badge", () => {
    expect(src).toContain("Coming soon");
  });

  test("shows development message", () => {
    expect(src).toContain("This module is in development");
  });

  test("no chart or fake data", () => {
    expect(src).not.toContain("MiniLineChart");
    expect(src).not.toContain("Sparkline");
    expect(src).not.toContain("StatCard");
    expect(src).not.toContain("fetch(");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 6: Middleware role gating for /analytics/*
// ═══════════════════════════════════════════════════════════════════
describe("Middleware: analytics role gating", () => {
  let middlewareSrc: string;

  beforeAll(() => {
    middlewareSrc = fs.readFileSync(path.resolve(__dirname, "../middleware.ts"), "utf-8");
  });

  test("middleware matcher includes /analytics/:path*", () => {
    expect(middlewareSrc).toContain("/analytics/:path*");
  });

  test("middleware gates analytics to manager/owner/admin roles", () => {
    expect(middlewareSrc).toContain('pathname.startsWith("/analytics")');
    expect(middlewareSrc).toContain('"manager"');
    expect(middlewareSrc).toContain('"owner"');
  });

  test("non-allowed roles redirect to /dashboard", () => {
    // Check the redirect destination is /dashboard
    const analyticsSection = middlewareSrc.slice(
      middlewareSrc.indexOf('pathname.startsWith("/analytics")'),
      middlewareSrc.indexOf("// Create a Supabase client")
    );
    expect(analyticsSection).toContain('"/dashboard"');
  });

  test("therapist role is NOT in the allowed list for analytics", () => {
    // Extract the allowedRoles array from the analytics section
    const analyticsSection = middlewareSrc.slice(
      middlewareSrc.indexOf('pathname.startsWith("/analytics")'),
      middlewareSrc.indexOf("// Create a Supabase client")
    );
    // The allowedRoles should not include "therapist"
    const allowedLine = analyticsSection.split("\n").find(l => l.includes("allowedRoles"));
    expect(allowedLine).toBeDefined();
    expect(allowedLine).not.toContain('"therapist"');
    expect(allowedLine).not.toContain('"patient"');
  });
});
