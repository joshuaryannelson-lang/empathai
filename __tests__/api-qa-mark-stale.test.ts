// __tests__/api-qa-mark-stale.test.ts
// Tests for POST /api/qa/mark-stale
/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { POST } from "@/app/api/qa/mark-stale/route";

function makeRequest(body: any): Request {
  return new Request("http://localhost/api/qa/mark-stale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/qa/mark-stale", () => {
  beforeEach(() => jest.clearAllMocks());

  test("valid page_id marks checks stale and returns count", async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: "1" }, { id: "2" }],
            error: null,
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ page_id: "landing" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updated).toBe(2);
    expect(json.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("qa_checks");
  });

  test("missing page_id returns 400", async () => {
    const res = await POST(makeRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/page_id/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("PHI guard: response contains no sensitive fields", async () => {
    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: "1" }],
            error: null,
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ page_id: "landing" }));
    const body = JSON.stringify(await res.json());

    expect(body).not.toContain('"last_name"');
    expect(body).not.toContain('"dob"');
    expect(body).not.toContain('"email"');
    expect(body).not.toContain('"phone"');
  });
});
