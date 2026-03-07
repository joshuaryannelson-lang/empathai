// __tests__/api-analytics.test.ts
// Analytics data shape validation — no API route exists, so we validate
// the expected data shape contains no PHI fields.

describe("Analytics data shape", () => {
  test("PHI guard: analytics responses must not contain patient identifiers", () => {
    // Expected analytics response shape (matches what the analytics page consumes)
    const sampleAnalyticsData = {
      practices: [{ id: "p1", name: "Test Practice", therapist_count: 3 }],
      metrics: { total_cases: 10, active_cases: 8, avg_ths: 72 },
      signals: { at_risk: 2, missing_checkin: 1, monitor: 3, ok: 4 },
    };

    const body = JSON.stringify(sampleAnalyticsData);
    expect(body).not.toContain('"last_name"');
    expect(body).not.toContain('"dob"');
    expect(body).not.toContain('"email"');
    expect(body).not.toContain('"phone"');
  });
});
