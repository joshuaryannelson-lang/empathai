// __tests__/portal-profile-setup.test.ts
// Suite: Profile setup (POST /api/portal/profile)
// GAP-17: Verifies patient-scoped Supabase client (not supabaseAdmin) for writes.

import {
  TEST_CASE_CODE_A,
} from "@/lib/fixtures/portalTestData";

const TEST_PATIENT_ID = "00000000-0000-0000-0000-patient00001";
const TEST_CASE_CODE_B = "EMP-OTHER1";

// ── Mock patientAuth ──
const mockAuthenticatePatient = jest.fn();
const mockExtractPatientToken = jest.fn();

jest.mock("@/lib/patientAuth", () => ({
  authenticatePatient: (...args: unknown[]) => mockAuthenticatePatient(...args),
  extractPatientToken: (...args: unknown[]) => mockExtractPatientToken(...args),
}));

// ── Mock createClient (patient-scoped) ──
const mockPatientFrom = jest.fn();
const mockCreateClient = jest.fn(() => ({
  from: (...args: unknown[]) => mockPatientFrom(...args),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// ── Mock supabaseAdmin (audit log only) ──
const mockAdminFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockAdminFrom(...args),
  },
}));

import { GET, POST } from "@/app/api/portal/profile/route";

function makeRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": "1.2.3.4",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost:3000/api/portal/profile", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// Track the payload passed to .update()
let capturedUpdatePayload: Record<string, unknown> | null = null;

function setupMocks(opts: {
  caseFound?: boolean;
  patientUpdated?: boolean;
  updateError?: boolean;
} = {}) {
  const { caseFound = true, patientUpdated = true, updateError = false } = opts;
  capturedUpdatePayload = null;

  mockExtractPatientToken.mockReturnValue("valid-token");

  mockPatientFrom.mockImplementation((table: string) => {
    if (table === "cases") {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: caseFound ? { patient_id: TEST_PATIENT_ID } : null,
              error: caseFound ? null : { message: "not found" },
            }),
          }),
        }),
      };
    }
    if (table === "patients") {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { has_completed_profile: true },
              error: null,
            }),
          }),
        }),
        update: jest.fn((payload: Record<string, unknown>) => {
          capturedUpdatePayload = payload;
          return {
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: updateError ? null : (patientUpdated ? [{ id: TEST_PATIENT_ID }] : []),
                error: updateError ? { message: "db error" } : null,
              }),
            }),
          };
        }),
      };
    }
    return {};
  });

  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "portal_audit_log") {
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    }
    return {};
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Test 1: Valid JWT + all fields -> 200 ──
test("valid JWT + all fields returns 200 and updates DB", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  const res = await POST(makeRequest(
    { preferred_name: "Jordan", pronouns: "they/them", timezone: "America/New_York" },
    "valid-token"
  ));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.success).toBe(true);
  expect(capturedUpdatePayload).toEqual({
    has_completed_profile: true,
    preferred_name: "Jordan",
    pronouns: "they/them",
    timezone: "America/New_York",
  });
});

// ── Test 2: Valid JWT + empty body (skip) -> 200, only has_completed_profile ──
test("valid JWT + empty body (skip) returns 200 with minimal update", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  const res = await POST(makeRequest({}, "valid-token"));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.success).toBe(true);
  expect(capturedUpdatePayload).toEqual({
    has_completed_profile: true,
  });
});

// ── Test 3: Valid JWT + patient_id matches no row -> 404 ──
test("valid JWT but patient row not found returns 404", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks({ patientUpdated: false });

  const res = await POST(makeRequest({ preferred_name: "Ghost" }, "valid-token"));
  const json = await res.json();

  expect(res.status).toBe(404);
  expect(json.error).toMatch(/not found/i);
});

// ── Test 4: No Authorization header -> 401 ──
test("missing auth header returns 401", async () => {
  mockAuthenticatePatient.mockResolvedValue(null);

  const res = await POST(makeRequest({ preferred_name: "Jordan" }));
  const json = await res.json();

  expect(res.status).toBe(401);
  expect(json.error).toMatch(/not authenticated/i);
});

// ── Test 5: Demo token (empty string) -> 401 ──
test("empty token (demo mode) returns 401", async () => {
  mockAuthenticatePatient.mockResolvedValue(null);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": "Bearer ",
  };
  const req = new Request("http://localhost:3000/api/portal/profile", {
    method: "POST",
    headers,
    body: JSON.stringify({ preferred_name: "Jordan" }),
  });

  const res = await POST(req);
  expect(res.status).toBe(401);
});

// ── Test 6: Email in preferred_name -> 400 ──
test("preferred_name with email pattern returns 400", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  const res = await POST(makeRequest(
    { preferred_name: "jordan@example.com" },
    "valid-token"
  ));
  const json = await res.json();

  expect(res.status).toBe(400);
  expect(json.error).toMatch(/first name only/i);
});

// ── Test 7: Phone in preferred_name -> 400 ──
test("preferred_name with phone pattern returns 400", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  const res = await POST(makeRequest(
    { preferred_name: "Call 555-123-4567" },
    "valid-token"
  ));
  const json = await res.json();

  expect(res.status).toBe(400);
  expect(json.error).toMatch(/first name only/i);
});

// ── Test 8: has_completed_profile always set to true ──
test("has_completed_profile is set to true even with partial fields", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  await POST(makeRequest({ pronouns: "she/her" }, "valid-token"));

  expect(capturedUpdatePayload).toHaveProperty("has_completed_profile", true);
  expect(capturedUpdatePayload).toHaveProperty("pronouns", "she/her");
  expect(capturedUpdatePayload).not.toHaveProperty("preferred_name");
  expect(capturedUpdatePayload).not.toHaveProperty("timezone");
});

// ── Test 9: DB error on update -> 500 ──
test("database update error returns 500", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks({ updateError: true });

  const res = await POST(makeRequest({ preferred_name: "Jordan" }, "valid-token"));

  expect(res.status).toBe(500);
});

// ── Test 10: Case not found -> 404 ──
test("case not found for case_code returns 404", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: "EMP-MISSING" });
  setupMocks({ caseFound: false });

  const res = await POST(makeRequest({ preferred_name: "Jordan" }, "valid-token"));
  const json = await res.json();

  expect(res.status).toBe(404);
  expect(json.error).toMatch(/case not found/i);
});

// ── Test 11: Invalid pronouns value is silently ignored ──
test("invalid pronouns value is ignored", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  await POST(makeRequest(
    { preferred_name: "Jordan", pronouns: "invalid-value" },
    "valid-token"
  ));

  expect(capturedUpdatePayload).not.toHaveProperty("pronouns");
});

// ── Test 12 (GAP-17): Uses patient-scoped createClient, not supabaseAdmin for writes ──
test("POST uses patient-scoped Supabase client, not supabaseAdmin", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  await POST(makeRequest({ preferred_name: "Jordan" }, "valid-token"));

  // createClient should have been called with anon key and patient JWT header
  expect(mockCreateClient).toHaveBeenCalled();
  const callArgs = mockCreateClient.mock.calls[0];
  const opts = callArgs[2] as { global?: { headers?: Record<string, string> } };
  expect(opts?.global?.headers?.Authorization).toBe("Bearer valid-token");

  // Patient data operations should go through mockPatientFrom, not mockAdminFrom
  const patientCalls = mockPatientFrom.mock.calls.map((c: unknown[]) => c[0]);
  expect(patientCalls).toContain("cases");
  expect(patientCalls).toContain("patients");

  // supabaseAdmin should only be called for audit log
  const adminCalls = mockAdminFrom.mock.calls.map((c: unknown[]) => c[0]);
  expect(adminCalls).toEqual(["portal_audit_log"]);
});

// ── Test 13 (GAP-17): Patient A JWT cannot write to Patient B's profile ──
// This tests the application logic — RLS is the real gate in production.
test("patient JWT scoped to case_code A cannot update patient B (0 rows)", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_B });
  mockExtractPatientToken.mockReturnValue("token-for-B");
  capturedUpdatePayload = null;

  // Case lookup returns a different patient_id
  const OTHER_PATIENT_ID = "00000000-0000-0000-0000-patient00002";

  mockPatientFrom.mockImplementation((table: string) => {
    if (table === "cases") {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { patient_id: OTHER_PATIENT_ID },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "patients") {
      return {
        update: jest.fn((payload: Record<string, unknown>) => {
          capturedUpdatePayload = payload;
          return {
            eq: jest.fn().mockReturnValue({
              // RLS would return 0 rows because the JWT case_code doesn't match
              select: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }),
      };
    }
    return {};
  });

  mockAdminFrom.mockImplementation(() => ({
    insert: jest.fn().mockResolvedValue({ error: null }),
  }));

  const res = await POST(makeRequest({ preferred_name: "Hacker" }, "token-for-B"));
  const json = await res.json();

  // With RLS, the update returns 0 rows -> 404
  expect(res.status).toBe(404);
  expect(json.error).toMatch(/not found/i);
});

// ── Test 14: GET uses patient-scoped client ──
test("GET uses patient-scoped Supabase client", async () => {
  mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: TEST_CASE_CODE_A });
  setupMocks();

  const req = new Request("http://localhost:3000/api/portal/profile", {
    headers: { Authorization: "Bearer valid-token" },
  });

  await GET(req);

  // Should use patient-scoped client
  expect(mockCreateClient).toHaveBeenCalled();
  const patientCalls = mockPatientFrom.mock.calls.map((c: unknown[]) => c[0]);
  expect(patientCalls).toContain("cases");
  expect(patientCalls).toContain("patients");
});
