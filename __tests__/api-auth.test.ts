// __tests__/api-auth.test.ts
// Tests for Sprint K-1 auth hardening: GAP-01, GAP-02, GAP-03, GAP-16
/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Mock getApiAuth to control auth state ──
const mockGetApiAuth = jest.fn();

jest.mock("@/lib/apiAuth", () => {
  const actual = jest.requireActual("@/lib/apiAuth");
  return {
    ...actual,
    getApiAuth: (...args: any[]) => mockGetApiAuth(...args),
    requireAuth: async () => {
      const auth = await mockGetApiAuth();
      if (!auth.authenticated) {
        const { bad } = await import("@/lib/route-helpers");
        return bad("Authentication required", 401);
      }
      return auth;
    },
    requireRole: async (...allowedRoles: string[]) => {
      const auth = await mockGetApiAuth();
      if (!auth.authenticated) {
        const { bad } = await import("@/lib/route-helpers");
        return bad("Authentication required", 401);
      }
      if (!auth.role || !allowedRoles.includes(auth.role)) {
        const { bad } = await import("@/lib/route-helpers");
        return bad("Forbidden", 403);
      }
      return auth;
    },
    logUnauthorizedAccess: jest.fn().mockResolvedValue(undefined),
    getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
    verifyCaseOwnership: jest.fn().mockResolvedValue(null),
    isAuthError: (result: any) => result instanceof Response,
  };
});

// ── Mock Supabase ──
const mockFrom = jest.fn();
const mockInsert = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
  supabaseAdmin: { from: (...args: any[]) => mockFrom(...args) },
}));

jest.mock("@/lib/demo/demoMode", () => ({
  isDemoMode: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/demo/demoData", () => ({
  getDemoCase: jest.fn(),
  getDemoAdminOverview: jest.fn(),
  demoCases: [],
  demoTherapists: [],
  demoCheckins: [],
  getDemoCaseGoals: jest.fn().mockReturnValue([]),
  getDemoCaseTasks: jest.fn().mockReturnValue([]),
  getDemoNormalizedCases: jest.fn().mockReturnValue([]),
  DEMO_TOUR_CASELOAD: {},
}));

jest.mock("@/lib/demo/demoIds", () => ({
  resolveDemoTherapistId: jest.fn((id: string) => id),
}));

jest.mock("@/lib/demo/demoAI", () => ({
  getDemoSessionPrepStructured: jest.fn(),
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimitAsync: jest.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 3600000 }),
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 3600000 }),
}));

jest.mock("@/lib/aiCostCeiling", () => ({
  checkAiCostCeiling: jest.fn().mockResolvedValue({ allowed: true, totalSpend: 0 }),
}));

jest.mock("@/lib/services/audit", () => ({
  logAiCall: jest.fn().mockResolvedValue(undefined),
  hashPrompt: jest.fn().mockReturnValue("test-hash"),
}));

jest.mock("@/lib/phi/scrub", () => ({
  scrubPrompt: jest.fn((text: string) => ({ text, flags: [] })),
  scrubOutput: jest.fn((text: string) => ({ text, flags: [] })),
}));

jest.mock("@/lib/services/taskGeneration", () => ({
  updateTaskStatus: jest.fn().mockResolvedValue({ id: "t1", status: "completed" }),
  createManualTask: jest.fn().mockResolvedValue({ id: "t1" }),
}));

jest.mock("@/lib/week", () => ({
  toMondayISO: jest.fn((d: string) => d),
}));

jest.mock("@/lib/constants", () => ({
  BUCKET: { LOW_SCORES: "low_scores", MISSING_CHECKINS: "missing_checkins" },
}));

// ── Helpers ──
function makeRequest(url: string, method = "GET", body?: any) {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(url, init);
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function setAuth(auth: { user_id?: string | null; role?: string | null; authenticated: boolean }) {
  mockGetApiAuth.mockResolvedValue({
    user_id: auth.user_id ?? null,
    role: auth.role ?? null,
    authenticated: auth.authenticated,
  });
}

// ── Tests ──

describe("GAP-01: Admin API auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        in: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  const adminRoutes = [
    { path: "/api/admin/stats", importPath: "@/app/api/admin/stats/route" },
    { path: "/api/admin/overview", importPath: "@/app/api/admin/overview/route" },
  ];

  for (const route of adminRoutes) {
    describe(`GET ${route.path}`, () => {
      test("no auth → 401", async () => {
        setAuth({ authenticated: false });
        const { GET } = await import(route.importPath);
        const res = await GET(makeRequest(`http://localhost${route.path}`));
        expect(res.status).toBe(401);
      });

      test("patient role → 403", async () => {
        setAuth({ authenticated: true, role: "patient" });
        const { GET } = await import(route.importPath);
        const res = await GET(makeRequest(`http://localhost${route.path}`));
        expect(res.status).toBe(403);
      });

      test("admin role → not 401/403", async () => {
        setAuth({ authenticated: true, role: "admin", user_id: "admin-1" });
        const { GET } = await import(route.importPath);
        const res = await GET(makeRequest(`http://localhost${route.path}`));
        expect([401, 403]).not.toContain(res.status);
      });
    });
  }

  test("POST /api/admin/ai-briefing no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { POST } = await import("@/app/api/admin/ai-briefing/route");
    const res = await POST(makeRequest("http://localhost/api/admin/ai-briefing", "POST", { prompt: "test" }));
    expect(res.status).toBe(401);
  });

  test("POST /api/admin/ai-briefing therapist → 403", async () => {
    setAuth({ authenticated: true, role: "therapist" });
    const { POST } = await import("@/app/api/admin/ai-briefing/route");
    const res = await POST(makeRequest("http://localhost/api/admin/ai-briefing", "POST", { prompt: "test" }));
    expect(res.status).toBe(403);
  });
});

describe("GAP-02: AI route auth + rate limiting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        gte: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    });
  });

  test("POST /api/ai/briefing no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { POST } = await import("@/app/api/ai/briefing/route");
    const res = await POST(makeRequest("http://localhost/api/ai/briefing", "POST", { dataSnapshot: {} }));
    expect(res.status).toBe(401);
  });

  test("POST /api/ai/briefing patient → 403", async () => {
    setAuth({ authenticated: true, role: "patient" });
    const { POST } = await import("@/app/api/ai/briefing/route");
    const res = await POST(makeRequest("http://localhost/api/ai/briefing", "POST", { dataSnapshot: {} }));
    expect(res.status).toBe(403);
  });

  test("POST /api/ai/briefing therapist → not 401/403", async () => {
    setAuth({ authenticated: true, role: "therapist", user_id: "t-1" });
    const { POST } = await import("@/app/api/ai/briefing/route");
    const res = await POST(makeRequest("http://localhost/api/ai/briefing", "POST", { dataSnapshot: { cases: [] } }));
    // Should pass auth (may fail on missing API key, but not auth)
    expect([401, 403]).not.toContain(res.status);
  });

  test("rate limit exceeded → 429", async () => {
    setAuth({ authenticated: true, role: "therapist", user_id: "t-1" });
    const { checkRateLimitAsync } = await import("@/lib/rateLimit");
    (checkRateLimitAsync as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 3600000,
    });
    const { POST } = await import("@/app/api/ai/briefing/route");
    const res = await POST(makeRequest("http://localhost/api/ai/briefing", "POST", { dataSnapshot: {} }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  test("cost ceiling exceeded → 503", async () => {
    setAuth({ authenticated: true, role: "therapist", user_id: "t-1" });
    const { checkAiCostCeiling } = await import("@/lib/aiCostCeiling");
    (checkAiCostCeiling as jest.Mock).mockResolvedValueOnce({ allowed: false, totalSpend: 30 });
    const { POST } = await import("@/app/api/ai/briefing/route");
    const res = await POST(makeRequest("http://localhost/api/ai/briefing", "POST", { dataSnapshot: {} }));
    expect(res.status).toBe(503);
  });
});

describe("GAP-03: Case mutation auth + ownership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: "case-1", therapist_id: "t-1" }, error: null }),
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        in: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: "case-1" }, error: null }),
          }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: "case-1" }, error: null }),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: "g-1" }, error: null }),
        }),
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: "r-1" }, error: null }),
        }),
      }),
    });
  });

  test("PATCH /api/cases/[id] no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { PATCH } = await import("@/app/api/cases/[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/cases/case-1", "PATCH", { title: "Updated" }),
      makeContext("case-1"),
    );
    expect(res.status).toBe(401);
  });

  test("DELETE /api/cases/[id] no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { DELETE } = await import("@/app/api/cases/[id]/route");
    const res = await DELETE(
      makeRequest("http://localhost/api/cases/case-1", "DELETE"),
      makeContext("case-1"),
    );
    expect(res.status).toBe(401);
  });

  test("POST /api/cases/[id]/goals no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { POST } = await import("@/app/api/cases/[id]/goals/route");
    const res = await POST(
      makeRequest("http://localhost/api/cases/case-1/goals", "POST", { title: "Goal" }),
      makeContext("case-1"),
    );
    expect(res.status).toBe(401);
  });

  test("POST /api/cases/[id]/ratings no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { POST } = await import("@/app/api/cases/[id]/ratings/route");
    const res = await POST(
      makeRequest("http://localhost/api/cases/case-1/ratings", "POST", { therapist_id: "t1", week_index: 1, S: 5, O: 5, T: 5 }),
      makeContext("case-1"),
    );
    expect(res.status).toBe(401);
  });

  test("POST /api/cases/[id]/check-ins no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { POST } = await import("@/app/api/cases/[id]/check-ins/route");
    const res = await POST(
      makeRequest("http://localhost/api/cases/case-1/check-ins", "POST", { week_start: "2026-03-02", score: 5 }),
      makeContext("case-1"),
    );
    expect(res.status).toBe(401);
  });

  test("ownership mismatch → 403", async () => {
    setAuth({ authenticated: true, role: "therapist", user_id: "wrong-user" });
    const { verifyCaseOwnership } = await import("@/lib/apiAuth");
    const { bad } = await import("@/lib/route-helpers");
    (verifyCaseOwnership as jest.Mock).mockResolvedValueOnce(bad("You are not assigned to this case", 403));

    const { PATCH } = await import("@/app/api/cases/[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/cases/case-1", "PATCH", { title: "Updated" }),
      makeContext("case-1"),
    );
    expect(res.status).toBe(403);
  });

  test("admin bypasses ownership → not 403", async () => {
    setAuth({ authenticated: true, role: "admin", user_id: "admin-1" });
    const { PATCH } = await import("@/app/api/cases/[id]/route");
    const res = await PATCH(
      makeRequest("http://localhost/api/cases/case-1", "PATCH", { title: "Updated" }),
      makeContext("case-1"),
    );
    expect([401, 403]).not.toContain(res.status);
  });
});

describe("GAP-16: Demo credentials auth", () => {
  beforeEach(() => jest.clearAllMocks());

  test("GET /api/qa/demo-credentials no auth → 401", async () => {
    setAuth({ authenticated: false });
    const { GET } = await import("@/app/api/qa/demo-credentials/route");
    const res = await GET(makeRequest("http://localhost/api/qa/demo-credentials"));
    expect(res.status).toBe(401);
  });

  test("GET /api/qa/demo-credentials patient → 403", async () => {
    setAuth({ authenticated: true, role: "patient" });
    const { GET } = await import("@/app/api/qa/demo-credentials/route");
    const res = await GET(makeRequest("http://localhost/api/qa/demo-credentials"));
    expect(res.status).toBe(403);
  });

  test("GET /api/qa/demo-credentials admin → not 401/403", async () => {
    setAuth({ authenticated: true, role: "admin", user_id: "admin-1" });
    const { GET } = await import("@/app/api/qa/demo-credentials/route");
    const res = await GET(makeRequest("http://localhost/api/qa/demo-credentials"));
    // Will be 503 because no DEMO_ env vars are set, but not an auth error
    expect([401, 403]).not.toContain(res.status);
  });
});

describe("No supabaseAdmin in mutation handlers", () => {
  test("case mutations use supabase (not supabaseAdmin)", async () => {
    // Verify by reading the source — these files should import supabase, not supabaseAdmin
    const fs = await import("fs");
    const mutationFiles = [
      "app/api/cases/[id]/route.ts",
      "app/api/cases/[id]/goals/route.ts",
      "app/api/cases/[id]/check-ins/route.ts",
      "app/api/cases/[id]/assignment/route.ts",
      "app/api/cases/[id]/ratings/route.ts",
      "app/api/cases/[id]/tasks/route.ts",
      "app/api/tasks/[id]/route.ts",
    ];

    for (const file of mutationFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Should import supabase (not supabaseAdmin)
      expect(content).toContain('from "@/lib/supabase"');
      // Should NOT use supabaseAdmin for mutations
      // (session-prep is excluded as it uses supabaseAdmin for justified read-only RLS bypass)
      const lines = content.split("\n");
      const importLine = lines.find(l => l.includes("import") && l.includes("supabase"));
      expect(importLine).toBeDefined();
      expect(importLine).not.toContain("supabaseAdmin");
    }
  });
});
