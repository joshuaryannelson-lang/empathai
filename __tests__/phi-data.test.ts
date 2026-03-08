// __tests__/phi-data.test.ts
// GAP-06: Verify no API route returns email, phone, or DOB in response payload.

const PHI_KEYS = ["email", "phone", "date_of_birth"];

// ── Mock Supabase ──
const mockSupabaseFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
  supabaseAdmin: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}));

jest.mock("@/lib/demo/demoMode", () => ({
  isDemoMode: () => false,
  DEMO_CONFIG: {
    practiceId: "demo-practice-01",
    therapistId: "demo-therapist-01",
    managerId: "demo-manager-01",
  },
}));

jest.mock("@/lib/demo/demoData", () => ({
  demoPatients: [],
  getDemoCase: () => null,
  getDemoPatient: () => null,
  getDemoTherapist: () => null,
  demoPractice: { id: "demo-practice-01", name: "Demo Practice" },
  getDemoTimeline: () => null,
}));

// Mock apiAuth to bypass cookies() call in test environment (GAP-34 added auth guard)
jest.mock("@/lib/apiAuth", () => ({
  requireRole: () => Promise.resolve({ user_id: "test-user", role: "admin", authenticated: true }),
  isAuthError: (r: unknown) => r instanceof Response,
}));

// ── Helpers ──
function chainable(resolvedData: unknown) {
  const self: Record<string, jest.Mock> = {};
  const makeSelf = () => self;
  self.select = jest.fn(makeSelf);
  self.eq = jest.fn(makeSelf);
  self.in = jest.fn(makeSelf);
  self.order = jest.fn(makeSelf);
  self.not = jest.fn(makeSelf);
  self.limit = jest.fn(makeSelf);
  self.single = jest.fn().mockResolvedValue({ data: resolvedData, error: null });
  self.insert = jest.fn(makeSelf);
  self.update = jest.fn(makeSelf);
  return self;
}

// ── Test: GET /api/patients/[id] strips PHI ──
test("GET /api/patients/[id] strips email/phone/dob from response", async () => {
  const patientWithPhi = {
    id: "p1",
    first_name: "Jordan",
    extended_profile: {
      email: "jordan@example.com",
      phone: "555-123-4567",
      date_of_birth: "1990-01-15",
      primary_diagnosis: "F32.1",
      clinical_notes: "Session notes here",
    },
  };

  mockSupabaseFrom.mockImplementation(() => chainable(patientWithPhi));

  const { GET } = await import("@/app/api/patients/[id]/route");
  const req = new Request("http://localhost:3000/api/patients/p1");
  const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });
  const json = await res.json();

  expect(res.status).toBe(200);
  const ep = json.data?.extended_profile ?? {};
  for (const key of PHI_KEYS) {
    expect(ep).not.toHaveProperty(key);
  }
  // Non-PHI fields should still be present
  expect(ep).toHaveProperty("primary_diagnosis", "F32.1");
  expect(ep).toHaveProperty("clinical_notes", "Session notes here");
});

// ── Test: PATCH /api/patients/[id] rejects PHI keys ──
test("PATCH /api/patients/[id] does not write email/phone/dob to extended_profile", async () => {
  let capturedUpdate: Record<string, unknown> | null = null;

  mockSupabaseFrom.mockImplementation(() => {
    const chain = chainable({ extended_profile: { primary_diagnosis: "F32.1" } });
    chain.update = jest.fn((payload: Record<string, unknown>) => {
      capturedUpdate = payload;
      const updateChain = chainable({ id: "p1", first_name: "Jordan", extended_profile: {} });
      return updateChain;
    });
    return chain;
  });

  const { PATCH } = await import("@/app/api/patients/[id]/route");
  const req = new Request("http://localhost:3000/api/patients/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "evil@example.com",
      phone: "555-000-0000",
      date_of_birth: "1990-01-01",
      primary_diagnosis: "F41.1",
    }),
  });

  await PATCH(req, { params: Promise.resolve({ id: "p1" }) });

  // extended_profile in the update payload must not contain PHI keys
  const ep = capturedUpdate?.extended_profile as Record<string, unknown> | undefined;
  expect(ep).toBeDefined();
  for (const key of PHI_KEYS) {
    expect(ep).not.toHaveProperty(key);
  }
  expect(ep).toHaveProperty("primary_diagnosis", "F41.1");
});

// ── Test: POST /api/patients rejects PII fields (GAP-34) ──
test("POST /api/patients rejects requests containing email/phone/dob", async () => {
  const { POST } = await import("@/app/api/patients/route");

  // Each PII field should be rejected with 422
  for (const [field, value] of [
    ["email", "test@example.com"],
    ["phone", "555-000-0000"],
    ["date_of_birth", "1990-01-01"],
  ]) {
    const req = new Request("http://localhost:3000/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: "Test", [field]: value }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error.message).toBe("pii_field_rejected");
  }
});

// ── Test: CHECK constraint SQL is valid ──
test("migration contains CHECK constraint rejecting PHI keys", async () => {
  const fs = require("fs");
  const sql = fs.readFileSync(
    "supabase/migrations/20260315_remove_phi_from_profile.sql",
    "utf-8"
  );
  expect(sql).toContain("no_phi_in_extended_profile");
  expect(sql).toContain("email");
  expect(sql).toContain("phone");
  expect(sql).toContain("date_of_birth");
});
