// __tests__/gap-35-status-codes.test.ts
// GAP-35: Verify routes return proper HTTP status codes on error.

// ── Mock Supabase before any imports ──────────────────────────────────────────
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockDelete = jest.fn();
const mockGte = jest.fn();
const mockNot = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            gte: (...gArgs: unknown[]) => {
              mockGte(...gArgs);
              return { not: (...nArgs: unknown[]) => { mockNot(...nArgs); return Promise.resolve({ data: [], error: null }); } };
            },
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return { single: () => mockSingle() };
            },
            single: () => mockSingle(),
          };
        },
        delete: () => {
          mockDelete();
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                select: () => ({
                  single: () => mockSingle(),
                }),
              };
            },
          };
        },
      };
    },
  },
  supabaseAdmin: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            gte: (...gArgs: unknown[]) => {
              mockGte(...gArgs);
              return Promise.resolve({ data: null, error: { message: "DB connection failed" } });
            },
          };
        },
      };
    },
  },
}));

jest.mock("@/lib/demo/demoMode", () => ({
  isDemoMode: () => false,
}));

jest.mock("@/lib/demo/demoStatusData", () => ({
  getDemoStatusResponse: () => ({}),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GAP-35: /api/status error handling", () => {
  test("returns HTTP 503 when supabaseAdmin query throws", async () => {
    const { GET } = await import("@/app/api/status/route");

    const req = new Request("http://localhost:3000/api/status");
    const res = await GET(req);

    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.overall).toBe("unknown");
    expect(body.error).toBe("Status check failed");
    expect(body.components).toEqual([]);
  });
});

describe("GAP-35: /api/practices/[id] DELETE error handling", () => {
  test("returns HTTP 404 when practice not found", async () => {
    // Configure mock to return "not found" error
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, return 0 rows" },
    });

    const { DELETE } = await import("@/app/api/practices/[id]/route");

    const req = new Request("http://localhost:3000/api/practices/nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.message).toBe("Practice not found");
    expect(body.data).toBeNull();
  });

  test("returns HTTP 500 on DB error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });

    const { DELETE } = await import("@/app/api/practices/[id]/route");

    const req = new Request("http://localhost:3000/api/practices/some-id", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "some-id" }) });

    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.data).toBeNull();
  });

  test("returns HTTP 200 with data on successful delete", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "abc", name: "Test Practice" },
      error: null,
    });

    const { DELETE } = await import("@/app/api/practices/[id]/route");

    const req = new Request("http://localhost:3000/api/practices/abc", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "abc" }) });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual({ id: "abc", name: "Test Practice" });
    expect(body.error).toBeNull();
  });
});
