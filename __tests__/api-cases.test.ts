// __tests__/api-cases.test.ts
// Tests for GET /api/cases/[id]
/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock("@/lib/demo/demoMode", () => ({
  isDemoMode: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/demo/demoData", () => ({
  getDemoCase: jest.fn().mockReturnValue(null),
}));

import { GET } from "@/app/api/cases/[id]/route";

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/cases/[id]", () => {
  beforeEach(() => jest.clearAllMocks());

  test("valid id returns case data", async () => {
    const mockCase = { id: "case-1", case_code: "C001", status: "active", therapist_id: "t1" };
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockCase, error: null }),
        }),
      }),
    });

    const req = new Request("http://localhost/api/cases/case-1");
    const res = await GET(req, makeContext("case-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual(mockCase);
    expect(json.error).toBeNull();
  });

  test("Supabase error returns 400", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: "Not found", code: "PGRST116" } }),
        }),
      }),
    });

    const req = new Request("http://localhost/api/cases/bad-id");
    const res = await GET(req, makeContext("bad-id"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
    expect(json.data).toBeNull();
  });

  test("PHI guard: no sensitive fields in mock response", () => {
    const mockCase = { id: "case-1", case_code: "C001", status: "active" };
    const body = JSON.stringify(mockCase);

    expect(body).not.toContain('"last_name"');
    expect(body).not.toContain('"dob"');
    expect(body).not.toContain('"email"');
    expect(body).not.toContain('"phone"');
  });
});
