/**
 * GAP-23: Profile GET returns full safe profile data
 */

import { GET } from "@/app/api/portal/profile/route";

// ── Mocks ──

const mockAuthenticatePatient = jest.fn();
const mockExtractPatientToken = jest.fn();
jest.mock("@/lib/patientAuth", () => ({
  authenticatePatient: (...args: unknown[]) => mockAuthenticatePatient(...args),
  extractPatientToken: (...args: unknown[]) => mockExtractPatientToken(...args),
}));

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock("@/lib/logger", () => ({
  safeLog: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

function makeRequest(): Request {
  return new Request("http://localhost/api/portal/profile", {
    method: "GET",
    headers: { Authorization: "Bearer test-token" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExtractPatientToken.mockReturnValue("test-token");
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ single: mockSingle });
});

describe("GAP-23: GET /api/portal/profile", () => {
  test("returns 401 when not authenticated", async () => {
    mockAuthenticatePatient.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  test("returns { has_completed_profile: false, profile: null } when no patient record", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: "EMP-TEST01" });
    mockSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.has_completed_profile).toBe(false);
    expect(json.profile).toBeNull();
  });

  test("returns full safe profile when profile exists", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: "EMP-TEST01" });

    // First call: cases table
    mockSingle
      .mockResolvedValueOnce({ data: { patient_id: "p1" }, error: null })
      // Second call: patients table
      .mockResolvedValueOnce({
        data: {
          has_completed_profile: true,
          preferred_name: "Alex",
          pronouns: "they/them",
          timezone: "America/New_York",
        },
        error: null,
      });

    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.has_completed_profile).toBe(true);
    expect(json.profile).toEqual({
      preferred_name: "Alex",
      pronouns: "they/them",
      timezone: "America/New_York",
    });
  });

  test("does not return PHI fields (no last_name, dob, email)", async () => {
    mockAuthenticatePatient.mockResolvedValue({ role: "patient", case_code: "EMP-TEST01" });

    mockSingle
      .mockResolvedValueOnce({ data: { patient_id: "p1" }, error: null })
      .mockResolvedValueOnce({
        data: {
          has_completed_profile: true,
          preferred_name: "Alex",
          pronouns: "they/them",
          timezone: "America/New_York",
          last_name: "Smith",
          dob: "1990-01-01",
          email: "alex@example.com",
        },
        error: null,
      });

    const res = await GET(makeRequest());
    const json = await res.json();
    // Profile should only contain safe fields
    expect(Object.keys(json.profile)).toEqual(["preferred_name", "pronouns", "timezone"]);
    expect(json.profile.last_name).toBeUndefined();
    expect(json.profile.dob).toBeUndefined();
    expect(json.profile.email).toBeUndefined();
  });
});
