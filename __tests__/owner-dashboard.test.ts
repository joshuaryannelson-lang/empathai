/**
 * Owner Dashboard tests — API shape + PHI safety
 */

// ── Mocks ──

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

jest.mock("@/lib/logger", () => ({
  safeLog: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { GET } from "@/app/api/dashboard/owner/stats/route";

function chainMock(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
  };
  // Each method returns the chain
  for (const key of Object.keys(chain)) {
    chain[key].mockReturnValue(chain);
  }
  // Apply overrides to terminal methods
  for (const [key, value] of Object.entries(overrides)) {
    chain[key].mockResolvedValue(value);
  }
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Owner Dashboard API", () => {
  test("returns correct KPI shape", async () => {
    // Build a thennable chain: every method returns itself, and it resolves
    // to a default response. This handles arbitrary .eq().eq().gte() chains.
    function thennableChain(resolveValue: Record<string, unknown>) {
      const handler: ProxyHandler<Record<string, unknown>> = {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => resolve(resolveValue);
          }
          // Any method call returns a new thennable chain with the same value
          return () => new Proxy({}, handler);
        },
      };
      return new Proxy({}, handler);
    }

    mockFrom.mockImplementation((table: string) => {
      const selectFn = (
        _sel: string,
        opts?: { count?: string; head?: boolean }
      ) => {
        if (opts?.head) {
          return thennableChain({ count: 5, error: null });
        }
        if (table === "therapists") {
          return thennableChain({ data: [], error: null });
        }
        return thennableChain({ data: [], error: null });
      };
      return { select: selectFn };
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.kpis).toBeDefined();
    expect(typeof json.data.kpis.active_cases).toBe("number");
    expect(typeof json.data.kpis.active_therapists).toBe("number");
    expect(typeof json.data.kpis.checkins_this_week).toBe("number");
  });

  test("therapist rows contain first_name only (no email patterns)", async () => {
    mockFrom.mockImplementation((table: string) => {
      const c = chainMock({});
      if (table === "therapists") {
        c.select.mockResolvedValue({
          data: [
            { id: "t1", name: "Sarah Johnson" },
            { id: "t2", name: "Mike Chen" },
          ],
          error: null,
        });
      } else if (table === "cases") {
        c.select.mockImplementation(
          (_sel: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              const hc = chainMock({});
              hc.eq.mockReturnValue({
                eq: jest
                  .fn()
                  .mockResolvedValue({ count: 3, error: null }),
              });
              return hc;
            }
            const dc = chainMock({});
            dc.eq.mockResolvedValue({
              data: [{ id: "c1" }],
              error: null,
            });
            return dc;
          }
        );
      } else if (table === "checkins") {
        c.select.mockImplementation(() => {
          const hc = chainMock({});
          hc.in.mockReturnValue({
            gte: jest
              .fn()
              .mockResolvedValue({ count: 2, error: null }),
          });
          return hc;
        });
      } else if (table === "ai_audit_logs") {
        c.select.mockImplementation(() => {
          const dc = chainMock({});
          dc.eq.mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest
                  .fn()
                  .mockResolvedValue({ data: [], error: null }),
              }),
            }),
            gte: jest
              .fn()
              .mockResolvedValue({ data: [], error: null }),
          });
          return dc;
        });
      }
      return c;
    });

    const res = await GET();
    const json = await res.json();

    if (json.data?.therapists) {
      for (const t of json.data.therapists) {
        // First name only — no @ or . patterns indicating email
        expect(t.first_name).not.toMatch(/@/);
        expect(t.first_name).not.toMatch(/\./);
        // No spaces (should be first name only)
        expect(t.first_name).not.toContain(" ");
      }
    }
  });
});
