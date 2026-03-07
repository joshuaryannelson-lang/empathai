import { classifyComponentStatus } from "@/app/api/status/route";

describe("classifyComponentStatus", () => {
  const threshold = 5;

  test("0 calls → Operational (low sample)", () => {
    const result = classifyComponentStatus(0, 0, threshold);
    expect(result.status).toBe("operational");
    expect(result.label).toContain("Low sample");
  });

  test("1 call, 1 error → Operational (low sample), NOT Major Outage", () => {
    const result = classifyComponentStatus(1, 1, threshold);
    expect(result.status).toBe("operational");
    expect(result.label).toContain("Low sample");
    expect(result.status).not.toBe("down");
  });

  test("4 calls, 2 errors → Operational (low sample)", () => {
    const result = classifyComponentStatus(2, 4, threshold);
    expect(result.status).toBe("operational");
    expect(result.label).toContain("Low sample");
  });

  test("5 calls, 0 errors → Operational", () => {
    const result = classifyComponentStatus(0, 5, threshold);
    expect(result.status).toBe("operational");
    expect(result.label).toBeUndefined();
  });

  test("10 calls, 1 error (10%) → Degraded", () => {
    const result = classifyComponentStatus(1, 10, threshold);
    expect(result.status).toBe("degraded");
  });

  test("10 calls, 5 errors (50%) → Major Outage (down)", () => {
    const result = classifyComponentStatus(5, 10, threshold);
    expect(result.status).toBe("down");
  });
});
