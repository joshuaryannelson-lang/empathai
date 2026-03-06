// __tests__/portal-safety-guards.test.ts
// Suite 6 (partial): Crisis detection + PHI detection pure function tests
// Suite 5: Legacy endpoint deprecation (static analysis)
// Suite 7: MFA gate for manager accounts

import { CRISIS_PHRASES, SAFE_PHRASES } from "@/lib/fixtures/portalTestData";
import { detectCrisisLanguage } from "@/app/portal/components/CrisisBanner";
import { detectPHI, phiWarningMessage } from "@/app/portal/components/PHIGuard";
import { checkMfaGate } from "@/lib/mfaGuard";
import * as fs from "fs";
import * as path from "path";

// ═══════════════════════════════════════════════════════════════════
// SUITE 6 (partial): Crisis Detection
// ═══════════════════════════════════════════════════════════════════
describe("Suite 6: Crisis Detection", () => {
  test("28. detects all known crisis phrases", () => {
    for (const phrase of CRISIS_PHRASES) {
      expect(detectCrisisLanguage(phrase)).toBe(true);
    }
  });

  test("29. does NOT flag safe phrases", () => {
    for (const phrase of SAFE_PHRASES) {
      expect(detectCrisisLanguage(phrase)).toBe(false);
    }
  });

  test("30. returns false for empty or very short input", () => {
    expect(detectCrisisLanguage("")).toBe(false);
    expect(detectCrisisLanguage("hi")).toBe(false);
    expect(detectCrisisLanguage("ok")).toBe(false);
  });

  // ── Expanded crisis phrase coverage (10 new tests) ──

  test("30a. detects 'suicide' standalone", () => {
    expect(detectCrisisLanguage("I keep thinking about suicide")).toBe(true);
  });

  test("30b. detects 'suicidal'", () => {
    expect(detectCrisisLanguage("I'm feeling suicidal today")).toBe(true);
  });

  test("30c. detects 'want to hurt myself'", () => {
    expect(detectCrisisLanguage("sometimes I want to hurt myself")).toBe(true);
  });

  test("30d. detects 'hurt myself' in longer sentence", () => {
    expect(detectCrisisLanguage("I've been thinking about hurting myself a lot")).toBe(true);
  });

  test("30e. detects 'end my life'", () => {
    expect(detectCrisisLanguage("I want to end my life")).toBe(true);
  });

  test("30f. detects 'don\u2019t want to be here'", () => {
    expect(detectCrisisLanguage("I don\u2019t want to be here anymore")).toBe(true);
    expect(detectCrisisLanguage("I don't want to be here")).toBe(true);
  });

  test("30g. detects 'can\u2019t go on'", () => {
    expect(detectCrisisLanguage("I can\u2019t go on like this")).toBe(true);
    expect(detectCrisisLanguage("I can't go on")).toBe(true);
  });

  test("30h. detects 'no reason to live'", () => {
    expect(detectCrisisLanguage("there is no reason to live")).toBe(true);
  });

  test("30i. detects 'self harm' without hyphen", () => {
    expect(detectCrisisLanguage("I have thoughts of self harm")).toBe(true);
  });

  test("30j. does NOT flag 'I hurt my knee' (false positive check)", () => {
    expect(detectCrisisLanguage("I hurt my knee yesterday")).toBe(false);
    expect(detectCrisisLanguage("I hurt my back lifting boxes")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 6 (partial): PHI Detection
// ═══════════════════════════════════════════════════════════════════
describe("Suite 6: PHI Detection", () => {
  test("31a. detects email addresses", () => {
    const violations = detectPHI("Reach me at jane@example.com please");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].name).toBe("email");
    expect(violations[0].match).toBe("jane@example.com");
  });

  test("31b. detects phone numbers", () => {
    const violations = detectPHI("Call 555-123-4567");
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].name).toBe("phone");
  });

  test("31c. detects SSN", () => {
    const violations = detectPHI("My SSN is 123-45-6789");
    expect(violations.some(v => v.name === "ssn")).toBe(true);
  });

  test("31d. detects street addresses", () => {
    const violations = detectPHI("I live at 123 Main Street");
    expect(violations.some(v => v.name === "address")).toBe(true);
  });

  test("31e. returns empty array for clean text", () => {
    expect(detectPHI("Feeling much better this week")).toEqual([]);
  });

  test("31f. returns empty for empty string", () => {
    expect(detectPHI("")).toEqual([]);
  });

  test("31g. phiWarningMessage returns null when no violations", () => {
    expect(phiWarningMessage([])).toBeNull();
  });

  test("31h. phiWarningMessage returns message with violation types", () => {
    const msg = phiWarningMessage([
      { name: "email", match: "a@b.com" },
      { name: "phone", match: "555-1234567" },
    ]);
    expect(msg).toContain("email addresses");
    expect(msg).toContain("phone numbers");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 5: Legacy Endpoint Removal (static analysis + tombstone)
// ═══════════════════════════════════════════════════════════════════
describe("Suite 5: Legacy Endpoint Removal", () => {
  const portalDir = path.resolve(__dirname, "../app/portal");

  function readPortalFiles(): { file: string; content: string }[] {
    const results: { file: string; content: string }[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          results.push({ file: full, content: fs.readFileSync(full, "utf-8") });
        }
      }
    }
    walk(portalDir);
    return results;
  }

  test("25. portal pages do not import supabaseAdmin directly", () => {
    const files = readPortalFiles();
    for (const { file, content } of files) {
      // Portal client pages must never use supabaseAdmin
      expect(content).not.toMatch(/import\s+.*supabaseAdmin/);
    }
  });

  test("26. portal pages reference session-based context, not raw identity", () => {
    // The main portal pages (checkin, history, goals) should use PortalIdentityContext
    const pages = ["checkin/page.tsx", "history/page.tsx", "goals/page.tsx"];
    for (const page of pages) {
      const filePath = path.join(portalDir, page);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("PortalIdentityContext");
    }
  });

  test("27. new checkin endpoint uses authenticatePatient, not raw UUID", () => {
    const checkinRoute = path.resolve(__dirname, "../app/api/portal/checkin/route.ts");
    const content = fs.readFileSync(checkinRoute, "utf-8");

    // Must use authenticatePatient
    expect(content).toContain("authenticatePatient");
    // Must NOT use params.id or params.caseId for auth
    expect(content).not.toMatch(/params\.(id|caseId)/);
    // Must create patient-scoped client
    expect(content).toContain("supabaseAsPatient");
  });

  // ── Tombstone tests: deleted legacy routes must never return ──

  test("33a. /api/patient/identify/route.ts does NOT exist (deleted)", () => {
    const identifyPath = path.resolve(__dirname, "../app/api/patient/identify/route.ts");
    expect(fs.existsSync(identifyPath)).toBe(false);
  });

  test("33b. /api/patient/[caseId]/checkin/route.ts does NOT exist (deleted)", () => {
    const legacyCheckinPath = path.resolve(__dirname, "../app/api/patient/[caseId]/checkin/route.ts");
    expect(fs.existsSync(legacyCheckinPath)).toBe(false);
  });

  test("33c. no portal page references /api/patient/identify", () => {
    const files = readPortalFiles();
    for (const { content } of files) {
      expect(content).not.toContain("/api/patient/identify");
    }
  });

  test("33d. no portal page references /api/patient/ legacy endpoint", () => {
    const files = readPortalFiles();
    for (const { content } of files) {
      expect(content).not.toMatch(/\/api\/patient\/[^/]*\/checkin/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 7: MFA Gate for Manager Accounts
// ═══════════════════════════════════════════════════════════════════
describe("Suite 7: MFA Gate", () => {
  test("32a. manager with aal1 is blocked from /admin, redirected to /auth/mfa-enroll", () => {
    const result = checkMfaGate({ role: "manager", aal: "aal1", path: "/admin" });
    expect(result.action).toBe("redirect");
    if (result.action === "redirect") {
      expect(result.destination).toContain("/auth/mfa-enroll");
      expect(result.destination).toContain("next=%2Fadmin");
    }
  });

  test("32b. manager with aal2 passes middleware on /admin routes", () => {
    const result = checkMfaGate({ role: "manager", aal: "aal2", path: "/admin" });
    expect(result.action).toBe("pass");

    const result2 = checkMfaGate({ role: "manager", aal: "aal2", path: "/admin/therapists" });
    expect(result2.action).toBe("pass");
  });

  test("32c. non-manager/non-therapist roles are not affected by MFA gate on general /admin routes", () => {
    // Patient at aal1 should pass
    expect(checkMfaGate({ role: "patient", aal: "aal1", path: "/admin" }).action).toBe("pass");
    // Admin at aal1 should pass everywhere
    expect(checkMfaGate({ role: "admin", aal: "aal1", path: "/admin" }).action).toBe("pass");
    expect(checkMfaGate({ role: "admin", aal: "aal1", path: "/admin/dev" }).action).toBe("pass");
    expect(checkMfaGate({ role: "admin", aal: "aal1", path: "/admin/status" }).action).toBe("pass");
    // No role should pass (unauthenticated — page handles its own auth)
    expect(checkMfaGate({ role: null, aal: null, path: "/admin" }).action).toBe("pass");
  });

  test("32d. MFA gate only applies to /admin routes", () => {
    // Manager at aal1 on non-admin routes should pass
    expect(checkMfaGate({ role: "manager", aal: "aal1", path: "/" }).action).toBe("pass");
    expect(checkMfaGate({ role: "manager", aal: "aal1", path: "/portal/checkin" }).action).toBe("pass");
    expect(checkMfaGate({ role: "manager", aal: "aal1", path: "/api/cases" }).action).toBe("pass");
  });

  test("32e. manager with null aal is blocked (same as aal1)", () => {
    const result = checkMfaGate({ role: "manager", aal: null, path: "/admin/patients" });
    expect(result.action).toBe("redirect");
    if (result.action === "redirect") {
      expect(result.destination).toContain("/auth/mfa-enroll");
    }
  });

  test("32f. redirect destination preserves original path", () => {
    const result = checkMfaGate({ role: "manager", aal: "aal1", path: "/admin/therapists" });
    if (result.action === "redirect") {
      expect(result.destination).toContain("next=%2Fadmin%2Ftherapists");
    }
  });

  test("32g. middleware.ts exists and imports mfaGuard", () => {
    const middlewarePath = path.resolve(__dirname, "../middleware.ts");
    expect(fs.existsSync(middlewarePath)).toBe(true);
    const content = fs.readFileSync(middlewarePath, "utf-8");
    expect(content).toContain("checkMfaGate");
    expect(content).toContain("mfa.getAuthenticatorAssuranceLevel");
  });

  test("32h-1. therapist has zero access to any /admin route", () => {
    const routes = ["/admin", "/admin/status", "/admin/dev", "/admin/therapists", "/admin/patients", "/admin/anything"];
    for (const route of routes) {
      const result = checkMfaGate({ role: "therapist", aal: "aal1", path: route });
      expect(result.action).toBe("redirect");
      if (result.action === "redirect") {
        expect(result.destination).toBe("/");
      }
    }
  });

  test("32h. MFA enrollment page exists and cannot be skipped", () => {
    const enrollPath = path.resolve(__dirname, "../app/auth/mfa-enroll/page.tsx");
    expect(fs.existsSync(enrollPath)).toBe(true);
    const content = fs.readFileSync(enrollPath, "utf-8");
    // Must use Supabase MFA API
    expect(content).toContain("mfa.enroll");
    expect(content).toContain("mfa.challenge");
    expect(content).toContain("mfa.verify");
    // Must state it's required
    expect(content).toContain("cannot be skipped");
    // Must NOT have a skip/dismiss button (onClick handler with skip/dismiss label)
    expect(content).not.toMatch(/onClick.*(?:Skip|Dismiss)/);
    expect(content).not.toMatch(/>Skip</);
    expect(content).not.toMatch(/>Dismiss</);
  });
});
