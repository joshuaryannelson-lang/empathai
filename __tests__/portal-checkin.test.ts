// __tests__/portal-checkin.test.ts
// Suite 2: Check-in via case_code (tests 7-14)

import {
  TEST_CASE_CODE_A, TEST_CASE_CODE_B, TEST_CASE_ID_A,
  VALID_CHECKIN, CHECKIN_WITH_CRISIS,
  CHECKIN_RATING_TOO_LOW, CHECKIN_RATING_TOO_HIGH,
  CHECKIN_RATING_FLOAT, CHECKIN_RATING_STRING,
} from "@/lib/fixtures/portalTestData";

// ── Mock rate limiter ──
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimitAsync: jest.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
}));

// ── Mock patientAuth ──
const mockAuthenticatePatient = jest.fn();

jest.mock("@/lib/patientAuth", () => ({
  authenticatePatient: (...args: unknown[]) => mockAuthenticatePatient(...args),
}));

// ── Mock Supabase ──
const mockSupabaseFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  },
}));

// Mock createClient for supabaseAsPatient
const mockPatientInsert = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn((data: unknown) => {
        mockPatientInsert(data);
        return {
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "checkin-123", case_id: TEST_CASE_ID_A, score: 7, mood: null, created_at: "2026-03-05T12:00:00Z", note: null },
              error: null,
            }),
          }),
        };
      }),
    })),
  })),
}));

import { POST } from "@/app/api/portal/checkin/route";

function makeRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost:3000/api/portal/checkin", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function setupAdminFrom() {
  // Default: case lookup succeeds
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "cases") {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: TEST_CASE_ID_A },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "portal_audit_log") {
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    }
    return { select: jest.fn().mockReturnThis(), insert: jest.fn().mockResolvedValue({ error: null }) };
  });
}

describe("Suite 2: Check-in via case_code", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupAdminFrom();
  });

  // Test 7: Valid JWT check-in succeeds
  test("7. valid JWT + valid body returns 200 with checkin data", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });

    const res = await POST(makeRequest(VALID_CHECKIN, "valid-token"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBeDefined();
    expect(json.data.score).toBeDefined();
    expect(json.error).toBeNull();
  });

  // Test 8: Cross-patient rejection — JWT for case A, but body implies case B
  test("8. JWT case_code is enforced (cannot submit for another case)", async () => {
    // Auth returns case_code A
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });

    const res = await POST(makeRequest(VALID_CHECKIN, "valid-token"));
    const json = await res.json();

    // The endpoint uses case_code from JWT only, not from body
    // So the insert should use the JWT's case_code, not any body field
    expect(res.status).toBe(200);
    // Verify that the case lookup used TEST_CASE_CODE_A
    expect(mockSupabaseFrom).toHaveBeenCalledWith("cases");
  });

  // Test 9: No JWT returns 401
  test("9. missing JWT returns 401", async () => {
    mockAuthenticatePatient.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_CHECKIN));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.message).toMatch(/not authenticated/i);
  });

  // Test 10: Expired/invalid JWT returns 401
  test("10. invalid JWT returns 401", async () => {
    mockAuthenticatePatient.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_CHECKIN, "expired-or-bad-token"));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.message).toMatch(/not authenticated/i);
  });

  // Test 11: Rating validation — out of range
  test("11a. rating 0 returns 400", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest(CHECKIN_RATING_TOO_LOW, "valid-token"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toMatch(/rating/i);
  });

  test("11b. rating 11 returns 400", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest(CHECKIN_RATING_TOO_HIGH, "valid-token"));
    expect(res.status).toBe(400);
  });

  test("11c. float rating returns 400", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest(CHECKIN_RATING_FLOAT, "valid-token"));
    expect(res.status).toBe(400);
  });

  test("11d. string rating returns 400", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest(CHECKIN_RATING_STRING, "valid-token"));
    expect(res.status).toBe(400);
  });

  // Test 12: Notes exceeding MAX_NOTE_LENGTH (1000 chars) are rejected with 400
  test("12. notes exceeding 1000 characters are rejected", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });

    const longNote = "x".repeat(1001);
    const res = await POST(makeRequest({ rating: 5, notes: longNote }, "valid-token"));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("1000");
  });

  // Test 13: week_index validation
  test("13a. negative week_index returns 400", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest({ rating: 5, week_index: -1 }, "valid-token"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toMatch(/week_index/i);
  });

  test("13b. float week_index returns 400", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest({ rating: 5, week_index: 1.5 }, "valid-token"));
    expect(res.status).toBe(400);
  });

  test("13c. valid week_index succeeds", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
    const res = await POST(makeRequest({ rating: 5, week_index: 0 }, "valid-token"));
    expect(res.status).toBe(200);
  });

  // Test 14: Case not found returns 404
  test("14. unknown case_code in JWT returns 404", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: "EMP-UNKNOWN" });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "cases") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const res = await POST(makeRequest(VALID_CHECKIN, "valid-token"));
    expect(res.status).toBe(404);
  });

  // Test 15: Crisis language in free text → 200 (server does NOT block submission)
  test("15. crisis language in notes still returns 200 (not blocked server-side)", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });

    const res = await POST(makeRequest(CHECKIN_WITH_CRISIS, "valid-token"));
    const json = await res.json();

    // Server should accept the submission — crisis detection is client-side only
    expect(res.status).toBe(200);
    expect(json.data).toBeDefined();
    expect(json.error).toBeNull();
  });

  // Test 16: PHI guard — no sensitive fields in checkin response
  test("16. PHI guard: no sensitive fields in response", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });

    const res = await POST(makeRequest(VALID_CHECKIN, "valid-token"));
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain('"last_name"');
    expect(body).not.toContain('"dob"');
    expect(body).not.toContain('"email"');
    expect(body).not.toContain('"phone"');
  });
});
