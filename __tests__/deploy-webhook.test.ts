/* eslint-disable @typescript-eslint/no-explicit-any */

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { POST } from "@/app/api/webhooks/deploy/route";

const TEST_SECRET = "test-webhook-secret-abc123";

function makeRequest(body: any, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/webhooks/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function setupMockChain(opts: { selectData?: any[]; selectError?: any; countResult?: number }) {
  const selectMock = jest.fn().mockResolvedValue({
    data: opts.selectData ?? [],
    error: opts.selectError ?? null,
  });
  const countMock = jest.fn().mockResolvedValue({
    count: opts.countResult ?? 0,
    error: null,
  });

  mockFrom.mockImplementation(() => ({
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue({ select: selectMock }),
        select: selectMock,
      }),
    }),
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue(countMock()),
        ...countMock(),
      }),
    }),
  }));
}

describe("POST /api/webhooks/deploy", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv, DEPLOY_WEBHOOK_SECRET: TEST_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("valid secret + pages[] → marks correct subset stale", async () => {
    setupMockChain({ selectData: [{ id: "1" }, { id: "2" }], countResult: 3 });

    const res = await POST(makeRequest({ secret: TEST_SECRET, pages: ["landing", "dashboard"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.marked_stale).toBe(2);
    expect(json.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("qa_checks");
  });

  test("valid secret + no pages[] → marks all passing checks stale", async () => {
    setupMockChain({ selectData: [{ id: "1" }, { id: "2" }, { id: "3" }], countResult: 3 });

    const res = await POST(makeRequest({ secret: TEST_SECRET }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.marked_stale).toBe(3);
    expect(json.error).toBeNull();
  });

  test("invalid secret → 401, zero DB writes", async () => {
    const res = await POST(makeRequest({ secret: "wrong-secret" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error.message).toBe("Invalid secret");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test("accepts secret via Authorization header", async () => {
    setupMockChain({ selectData: [{ id: "1" }], countResult: 1 });

    const res = await POST(makeRequest({}, { Authorization: `Bearer ${TEST_SECRET}` }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.marked_stale).toBe(1);
  });

  test("missing DEPLOY_WEBHOOK_SECRET env → 500", async () => {
    delete process.env.DEPLOY_WEBHOOK_SECRET;

    const res = await POST(makeRequest({ secret: "anything" }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.message).toContain("not configured");
  });
});
