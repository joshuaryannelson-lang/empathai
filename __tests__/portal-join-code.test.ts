// __tests__/portal-join-code.test.ts
// Suite 1: Join Code Redemption (tests 1-6)
// Suite 4: Join Code Generation (tests 20-24)

import { VALID_JOIN_CODE, EXPIRED_JOIN_CODE, REDEEMED_JOIN_CODE, TEST_CASE_CODE_A } from "@/lib/fixtures/portalTestData";

// ── Mock Supabase ──
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();

function chainMock(overrides: Record<string, jest.Mock> = {}) {
  const chain: Record<string, jest.Mock> = {
    select: overrides.select ?? jest.fn().mockReturnThis(),
    insert: overrides.insert ?? jest.fn().mockReturnThis(),
    update: overrides.update ?? jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: overrides.single ?? jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: overrides.maybeSingle ?? jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  // Every method returns the chain
  for (const key of Object.keys(chain)) {
    if (!["single", "maybeSingle"].includes(key)) {
      chain[key].mockReturnValue(chain);
    }
  }
  return chain;
}

let fromHandlers: Record<string, ReturnType<typeof chainMock>> = {};

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (fromHandlers[table]) return fromHandlers[table];
      return chainMock();
    }),
  },
}));

jest.mock("@/lib/patientAuth", () => ({
  mintPatientJWT: jest.fn().mockResolvedValue("mock-jwt-token"),
  verifyPatientJWT: jest.fn(),
  authenticatePatient: jest.fn(),
  extractPatientToken: jest.fn(),
}));

// ── Import routes AFTER mocks ──
import { POST as joinPOST } from "@/app/api/portal/join/route";
import { POST as generatePOST } from "@/app/api/portal/join/generate/route";
import { mintPatientJWT } from "@/lib/patientAuth";

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/portal/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4", ...headers },
    body: JSON.stringify(body),
  });
}

function makeGenerateRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/portal/join/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ═══════════════════════════════════════════════════════════════════
// SUITE 1: Join Code Redemption
// ═══════════════════════════════════════════════════════════════════
describe("Suite 1: Join Code Redemption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromHandlers = {};
  });

  // Test 1: Happy path — valid join code returns token + case_code
  test("1. valid join code returns token and case_code", async () => {
    const attemptsChain = chainMock();
    attemptsChain.select.mockReturnValue({
      ...attemptsChain,
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockResolvedValue({ count: 0 }),
      }),
    });
    attemptsChain.insert.mockResolvedValue({ error: null });

    const joinCodesChain = chainMock();
    joinCodesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "jc-1", code: VALID_JOIN_CODE, case_code: TEST_CASE_CODE_A, expires_at: "2099-01-01", redeemed_at: null },
              error: null,
            }),
          }),
        }),
      }),
    });
    joinCodesChain.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const auditChain = chainMock();
    auditChain.insert.mockResolvedValue({ error: null });

    fromHandlers = {
      join_code_attempts: attemptsChain,
      join_codes: joinCodesChain,
      portal_audit_log: auditChain,
    };

    const res = await joinPOST(makeRequest({ code: VALID_JOIN_CODE }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.token).toBe("mock-jwt-token");
    expect(json.data.case_code).toBe(TEST_CASE_CODE_A);
    expect(json.error).toBeNull();
    expect(mintPatientJWT).toHaveBeenCalledWith(TEST_CASE_CODE_A);
  });

  // Test 2: Expired join code returns 404
  test("2. expired join code returns 404", async () => {
    const attemptsChain = chainMock();
    attemptsChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockResolvedValue({ count: 0 }),
      }),
    });
    attemptsChain.insert.mockResolvedValue({ error: null });

    const joinCodesChain = chainMock();
    joinCodesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const auditChain = chainMock();
    auditChain.insert.mockResolvedValue({ error: null });

    fromHandlers = {
      join_code_attempts: attemptsChain,
      join_codes: joinCodesChain,
      portal_audit_log: auditChain,
    };

    const res = await joinPOST(makeRequest({ code: EXPIRED_JOIN_CODE }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.message).toMatch(/invalid|expired/i);
    expect(json.data).toBeNull();
  });

  // Test 3: Already-redeemed join code returns 404
  test("3. already-redeemed join code returns 404", async () => {
    const attemptsChain = chainMock();
    attemptsChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockResolvedValue({ count: 0 }),
      }),
    });
    attemptsChain.insert.mockResolvedValue({ error: null });

    // Already redeemed — `.is("redeemed_at", null)` means it won't match
    const joinCodesChain = chainMock();
    joinCodesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const auditChain = chainMock();
    auditChain.insert.mockResolvedValue({ error: null });

    fromHandlers = {
      join_code_attempts: attemptsChain,
      join_codes: joinCodesChain,
      portal_audit_log: auditChain,
    };

    const res = await joinPOST(makeRequest({ code: REDEEMED_JOIN_CODE }));
    expect(res.status).toBe(404);
  });

  // Test 4: Rate limiting — 6th attempt returns 429
  test("4. rate limiting blocks after 5 attempts per IP per hour", async () => {
    const attemptsChain = chainMock();
    attemptsChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockResolvedValue({ count: 5 }), // Already at limit
      }),
    });

    const auditChain = chainMock();
    auditChain.insert.mockResolvedValue({ error: null });

    fromHandlers = {
      join_code_attempts: attemptsChain,
      portal_audit_log: auditChain,
    };

    const res = await joinPOST(makeRequest({ code: "ABCD-1234" }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error.message).toMatch(/too many attempts/i);
  });

  // Test 5: Malformed/short join code returns 400
  test("5. malformed join code (too short) returns 400", async () => {
    const res = await joinPOST(makeRequest({ code: "AB" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/required/i);
  });

  // Test 6: Audit log is written on successful redemption
  test("6. audit log records join_code_redeemed event", async () => {
    const attemptsChain = chainMock();
    attemptsChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        gte: jest.fn().mockResolvedValue({ count: 0 }),
      }),
    });
    attemptsChain.insert.mockResolvedValue({ error: null });

    const auditInsert = jest.fn().mockResolvedValue({ error: null });
    const auditChain = chainMock({ insert: auditInsert });

    const joinCodesChain = chainMock();
    joinCodesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: "jc-audit", code: VALID_JOIN_CODE, case_code: TEST_CASE_CODE_A, expires_at: "2099-01-01", redeemed_at: null },
              error: null,
            }),
          }),
        }),
      }),
    });
    joinCodesChain.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    fromHandlers = {
      join_code_attempts: attemptsChain,
      join_codes: joinCodesChain,
      portal_audit_log: auditChain,
    };

    await joinPOST(makeRequest({ code: VALID_JOIN_CODE }));

    // The audit insert should have been called with the redeemed event
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "join_code_redeemed",
        case_code: TEST_CASE_CODE_A,
        ip: "1.2.3.4",
      })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE 4: Join Code Generation
// ═══════════════════════════════════════════════════════════════════
describe("Suite 4: Join Code Generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromHandlers = {};
  });

  // Test 20: Generate join code for own case (happy path)
  test("20. generates join code for a valid case_code", async () => {
    const casesChain = chainMock();
    casesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "case-uuid", case_code: TEST_CASE_CODE_A },
          error: null,
        }),
      }),
    });

    const joinCodesChain = chainMock();
    // Invalidation of old codes
    joinCodesChain.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    // Insert new code
    joinCodesChain.insert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "new-jc", code: "XYZW-1234", expires_at: "2099-01-01T00:00:00Z" },
          error: null,
        }),
      }),
    });

    fromHandlers = {
      cases: casesChain,
      join_codes: joinCodesChain,
    };

    const res = await generatePOST(makeGenerateRequest({ case_code: TEST_CASE_CODE_A }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.code).toBeDefined();
    expect(json.data.expires_at).toBeDefined();
    // Must NOT return case_code or patient info
    expect(json.data.case_code).toBeUndefined();
    expect(json.data.patient_name).toBeUndefined();
  });

  // Test 21: Generate for non-existent case returns 404
  test("21. non-existent case_code returns 404", async () => {
    const casesChain = chainMock();
    casesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      }),
    });

    fromHandlers = { cases: casesChain };

    const res = await generatePOST(makeGenerateRequest({ case_code: "EMP-NONEXIST" }));
    expect(res.status).toBe(404);
  });

  // Test 22: Missing case_code in body returns 400
  test("22. missing case_code returns 400", async () => {
    const res = await generatePOST(makeGenerateRequest({}));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/case_code.*required/i);
  });

  // Test 23: Response never contains case_code or patient info
  test("23. response never leaks case_code or patient info", async () => {
    const casesChain = chainMock();
    casesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "case-uuid", case_code: TEST_CASE_CODE_A },
          error: null,
        }),
      }),
    });

    const joinCodesChain = chainMock();
    joinCodesChain.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    joinCodesChain.insert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "new-jc", code: "ABCD-9999", expires_at: "2099-01-01T00:00:00Z" },
          error: null,
        }),
      }),
    });

    fromHandlers = { cases: casesChain, join_codes: joinCodesChain };

    const res = await generatePOST(makeGenerateRequest({ case_code: TEST_CASE_CODE_A }));
    const json = await res.json();
    const responseStr = JSON.stringify(json);

    expect(responseStr).not.toContain(TEST_CASE_CODE_A);
    expect(responseStr).not.toContain("patient_id");
    expect(responseStr).not.toContain("patient_name");
  });

  // Test 23b: PHI guard — no sensitive fields in join response
  test("23b. PHI guard: no last_name, dob, email, or phone in response", async () => {
    const casesChain = chainMock();
    casesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "case-uuid", case_code: TEST_CASE_CODE_A },
          error: null,
        }),
      }),
    });

    const joinCodesChain = chainMock();
    joinCodesChain.update.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    joinCodesChain.insert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "new-jc", code: "ABCD-5678", expires_at: "2099-01-01T00:00:00Z" },
          error: null,
        }),
      }),
    });

    fromHandlers = { cases: casesChain, join_codes: joinCodesChain };

    const res = await generatePOST(makeGenerateRequest({ case_code: TEST_CASE_CODE_A }));
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain('"last_name"');
    expect(body).not.toContain('"dob"');
    expect(body).not.toContain('"email"');
    expect(body).not.toContain('"phone"');
  });

  // Test 24: Join code expiry is ~48 hours
  test("24. invalidates existing active codes before generating new one", async () => {
    const casesChain = chainMock();
    casesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "case-uuid", case_code: TEST_CASE_CODE_A },
          error: null,
        }),
      }),
    });

    const joinUpdateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const joinCodesChain = chainMock({ update: joinUpdateMock });
    joinCodesChain.insert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: "jc-new", code: "NEW1-CODE", expires_at: "2099-01-01T00:00:00Z" },
          error: null,
        }),
      }),
    });

    fromHandlers = { cases: casesChain, join_codes: joinCodesChain };

    await generatePOST(makeGenerateRequest({ case_code: TEST_CASE_CODE_A }));

    // The update call should have been made to invalidate old codes
    expect(joinUpdateMock).toHaveBeenCalled();
  });
});
