// __tests__/audit-error-logging.test.ts
// Tests for error field in logAiCall and /api/status error counting

import { hashPrompt } from "@/lib/services/audit";

// ── Mock supabaseAdmin ──────────────────────────────────────────────────────

const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Import after mock
import { logAiCall, type AuditEntry } from "@/lib/services/audit";

beforeEach(() => {
  mockInsert.mockClear();
  mockFrom.mockClear();
  mockInsert.mockResolvedValue({ error: null });
});

// ── logAiCall error flag tests ──────────────────────────────────────────────

describe("logAiCall error flag", () => {
  const baseEntry: AuditEntry = {
    service: "test-service",
    triggered_by: "test",
    input_hash: hashPrompt("test prompt"),
  };

  test("writes error=false by default", async () => {
    await logAiCall(baseEntry);

    expect(mockFrom).toHaveBeenCalledWith("ai_audit_logs");
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const row = mockInsert.mock.calls[0][0];
    expect(row.error).toBe(false);
    expect(row.service).toBe("test-service");
  });

  test("writes error=true when error flag is set", async () => {
    await logAiCall({ ...baseEntry, error: true });

    expect(mockInsert).toHaveBeenCalledTimes(1);

    const row = mockInsert.mock.calls[0][0];
    expect(row.error).toBe(true);
    expect(row.service).toBe("test-service");
  });

  test("writes error=false when explicitly set to false", async () => {
    await logAiCall({ ...baseEntry, error: false });

    const row = mockInsert.mock.calls[0][0];
    expect(row.error).toBe(false);
  });

  test("error field coexists with blocked field", async () => {
    await logAiCall({ ...baseEntry, blocked: true, error: true });

    const row = mockInsert.mock.calls[0][0];
    expect(row.blocked).toBe(true);
    expect(row.error).toBe(true);
  });
});

// ── /api/status error counting tests ────────────────────────────────────────

describe("/api/status errorsToday calculation", () => {
  // Simulate the same logic used in route.ts for counting errors
  function countErrors(logs: Array<{ service: string; error?: boolean }>, serviceName: string): number {
    return logs.filter(l => l.service === serviceName && l.error === true).length;
  }

  test("counts error=true rows for a specific service", () => {
    const logs = [
      { service: "session-prep", error: true },
      { service: "session-prep", error: false },
      { service: "session-prep", error: true },
      { service: "briefing", error: true },
    ];

    expect(countErrors(logs, "session-prep")).toBe(2);
    expect(countErrors(logs, "briefing")).toBe(1);
    expect(countErrors(logs, "ths-scoring")).toBe(0);
  });

  test("returns 0 when no errors exist", () => {
    const logs = [
      { service: "session-prep", error: false },
      { service: "session-prep" },
    ];

    expect(countErrors(logs, "session-prep")).toBe(0);
  });

  test("returns 0 for empty log array", () => {
    expect(countErrors([], "session-prep")).toBe(0);
  });

  test("totalErrorsToday aggregates across all services", () => {
    const logs = [
      { service: "session-prep", error: true },
      { service: "briefing", error: true },
      { service: "ths-scoring", error: false },
      { service: "redaction", error: true },
    ];

    const totalErrors = logs.filter(l => l.error === true).length;
    expect(totalErrors).toBe(3);
  });
});

// ── Status page no NavSidebar test ──────────────────────────────────────────

describe("/status page standalone", () => {
  test("status page file does not import NavSidebar", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      require("path").resolve(__dirname, "../app/status/page.tsx"),
      "utf-8"
    );

    expect(content).not.toContain("NavSidebar");
    expect(content).not.toContain("sidebarPracticeId");
    expect(content).not.toContain("sidebarTherapistId");
  });

  test("status page contains standalone header with EmpathAI branding", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      require("path").resolve(__dirname, "../app/status/page.tsx"),
      "utf-8"
    );

    expect(content).toContain("EmpathAI");
    expect(content).toContain("Back to app");
    expect(content).toContain("<header");
  });
});

// ── /api/status route file validation ───────────────────────────────────────

describe("/api/status route uses real error queries", () => {
  test("route file does not have hardcoded errorsToday: 0", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      require("path").resolve(__dirname, "../app/api/status/route.ts"),
      "utf-8"
    );

    // Should NOT contain the old hardcoded value
    expect(content).not.toMatch(/errorsToday:\s*0\s*,/);
    expect(content).not.toMatch(/totalErrorsToday:\s*0\s*,/);

    // Should contain the real error counting logic
    expect(content).toContain("l.error === true");
  });

  test("route file selects error column from ai_audit_logs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      require("path").resolve(__dirname, "../app/api/status/route.ts"),
      "utf-8"
    );

    // Select query should include the error field
    const selectMatches = content.match(/\.select\([^)]*error[^)]*\)/g);
    expect(selectMatches).not.toBeNull();
    expect(selectMatches!.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Migration file validation ───────────────────────────────────────────────

describe("error column migration", () => {
  test("migration file exists and adds error column", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      require("path").resolve(__dirname, "../supabase/migrations/20260306_add_error_column.sql"),
      "utf-8"
    );

    expect(content).toContain("error boolean");
    expect(content).toContain("default false");
  });
});

// ── AuditEntry interface validation ─────────────────────────────────────────

describe("AuditEntry interface", () => {
  test("error field is optional boolean", () => {
    // TypeScript compile-time check: these should all be valid AuditEntry objects
    const withError: AuditEntry = {
      service: "test",
      triggered_by: "test",
      input_hash: "abc",
      error: true,
    };
    const withoutError: AuditEntry = {
      service: "test",
      triggered_by: "test",
      input_hash: "abc",
    };

    expect(withError.error).toBe(true);
    expect(withoutError.error).toBeUndefined();
  });
});
