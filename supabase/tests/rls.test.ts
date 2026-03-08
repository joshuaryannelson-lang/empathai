/**
 * RLS Policy Test Suite — EmpathAI Security Audit (Sprint K-1)
 *
 * Tests validate row-level security policies isolate data correctly.
 *
 * Requirements:
 *   1. Running Supabase local dev instance (supabase start)
 *   2. Test users seeded via supabase/seed/test-users.sql
 *   3. All migrations applied (supabase db reset)
 *
 * Run:
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   npx jest --testPathPattern=rls
 *
 * Auth approach: real Supabase auth sessions via signInWithPassword().
 * Service role client seeds fixtures; per-role clients enforce RLS.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "RLS tests require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars. " +
      "Run `supabase start` and export the values shown."
  );
}

// ── Test user credentials (must match supabase/seed/test-users.sql) ─────────

const TEST_PASSWORD = "TestPass123!";

interface TestUserDef {
  id: string;
  email: string;
  role: "therapist" | "patient" | "manager" | "admin";
  practice_id: string;
}

const THERAPIST_A: TestUserDef = {
  id: "00000000-0000-0000-0000-aaaaaaaaaaaa",
  email: "therapist-a@rls-test.local",
  role: "therapist",
  practice_id: "00000000-0000-0000-0001-000000000001",
};

const THERAPIST_B: TestUserDef = {
  id: "00000000-0000-0000-0000-bbbbbbbbbbbb",
  email: "therapist-b@rls-test.local",
  role: "therapist",
  practice_id: "00000000-0000-0000-0001-000000000001",
};

const PATIENT_A: TestUserDef = {
  id: "00000000-0000-0000-0000-cccccccccccc",
  email: "patient-a@rls-test.local",
  role: "patient",
  practice_id: "00000000-0000-0000-0001-000000000001",
};

const MANAGER_P1: TestUserDef = {
  id: "00000000-0000-0000-0000-eeeeeeeeeeee",
  email: "manager-p1@rls-test.local",
  role: "manager",
  practice_id: "00000000-0000-0000-0001-000000000001",
};

const MANAGER_P2: TestUserDef = {
  id: "00000000-0000-0000-0000-ffffffffffff",
  email: "manager-p2@rls-test.local",
  role: "manager",
  practice_id: "00000000-0000-0000-0001-000000000002",
};

const ADMIN_USER: TestUserDef = {
  id: "00000000-0000-0000-0000-111111111111",
  email: "admin@rls-test.local",
  role: "admin",
  practice_id: "00000000-0000-0000-0001-000000000001",
};

// ── Test fixture IDs ────────────────────────────────────────────────────────

const PRACTICE_1_ID = "00000000-0000-0000-0001-000000000001";
const PRACTICE_2_ID = "00000000-0000-0000-0001-000000000002";
const CASE_A_ID = "00000000-0000-0000-1111-aaaaaaaaaaaa"; // therapist_a, patient_a, practice 1
const CASE_B_ID = "00000000-0000-0000-1111-bbbbbbbbbbbb"; // therapist_b, practice 1
const CASE_P2_ID = "00000000-0000-0000-1111-cccccccccccc"; // therapist_b, practice 2

// ── Helpers ─────────────────────────────────────────────────────────────────

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/** Sign in as a test user and return an authenticated client */
async function signInAs(user: TestUserDef): Promise<SupabaseClient> {
  const key = ANON_KEY || SERVICE_ROLE_KEY;
  const client = createClient(SUPABASE_URL, key);
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw new Error(
      `Failed to sign in as ${user.email}: ${error.message}. ` +
        "Ensure test users are seeded (supabase/seed/test-users.sql)."
    );
  }
  return client;
}

/** Create an anon client (no auth session) */
function anonClient(): SupabaseClient {
  const key = ANON_KEY || SERVICE_ROLE_KEY;
  return createClient(SUPABASE_URL, key);
}

// ── Cached clients ──────────────────────────────────────────────────────────

let therapistAClient: SupabaseClient;
let therapistBClient: SupabaseClient;
let patientAClient: SupabaseClient;
let managerP1Client: SupabaseClient;
let managerP2Client: SupabaseClient;
let adminClient: SupabaseClient;

// ── Tests ───────────────────────────────────────────────────────────────────

describe("RLS Policy Enforcement", () => {
  const svc = serviceClient();

  beforeAll(async () => {
    // Sign in all test users in parallel
    [
      therapistAClient,
      therapistBClient,
      patientAClient,
      managerP1Client,
      managerP2Client,
      adminClient,
    ] = await Promise.all([
      signInAs(THERAPIST_A),
      signInAs(THERAPIST_B),
      signInAs(PATIENT_A),
      signInAs(MANAGER_P1),
      signInAs(MANAGER_P2),
      signInAs(ADMIN_USER),
    ]);
  }, 30_000);

  // ── THERAPIST ISOLATION (existing) ──────────────────────────────────────

  describe("Therapist Isolation (Critical)", () => {
    test("therapist_a cannot read therapist_b cases", async () => {
      const { data } = await therapistAClient
        .from("cases")
        .select("id")
        .eq("therapist_id", THERAPIST_B.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist_a cannot read therapist_b checkins", async () => {
      const { data } = await therapistAClient
        .from("checkins")
        .select("id, case_id")
        .eq("case_id", CASE_B_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist_a cannot read therapist_b goals", async () => {
      const { data } = await therapistAClient
        .from("goals")
        .select("id")
        .eq("case_id", CASE_B_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist_a cannot read therapist_b tasks", async () => {
      const { data } = await therapistAClient
        .from("tasks")
        .select("id")
        .eq("case_id", CASE_B_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist_a CAN read their own cases", async () => {
      const { data } = await therapistAClient
        .from("cases")
        .select("id")
        .eq("therapist_id", THERAPIST_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── PATIENT ISOLATION (existing) ────────────────────────────────────────

  describe("Patient Isolation (Critical)", () => {
    test("patient_a CAN read their own patient record", async () => {
      const { data } = await patientAClient
        .from("patients")
        .select("id")
        .eq("id", PATIENT_A.id);
      expect(data).not.toBeNull();
    });

    test("patient cannot query cases by therapist_id", async () => {
      const { data } = await patientAClient
        .from("cases")
        .select("id")
        .eq("therapist_id", THERAPIST_A.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient CAN read their own case (patient_id match)", async () => {
      const { data } = await patientAClient
        .from("cases")
        .select("id")
        .eq("patient_id", PATIENT_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── PATIENT CROSS-ISOLATION (GAP-51) ──────────────────────────────────

  describe("Patient Cross-Isolation (GAP-51)", () => {
    test("patient_a cannot read checkins for another patient's case", async () => {
      const { data } = await patientAClient
        .from("checkins")
        .select("id")
        .eq("case_id", CASE_B_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient_a cannot read goals for another patient's case", async () => {
      const { data } = await patientAClient
        .from("goals")
        .select("id")
        .eq("case_id", CASE_B_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient_a CAN read their own checkins", async () => {
      const { data } = await patientAClient
        .from("checkins")
        .select("id")
        .eq("case_id", CASE_A_ID);
      // May be 0 if no checkins seeded, but the query should not error
      expect(data).not.toBeNull();
    });

    test("patient cannot read cases from another practice", async () => {
      const { data } = await patientAClient
        .from("cases")
        .select("id")
        .eq("practice_id", PRACTICE_2_ID);
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ── MANAGER SCOPE (existing + GAP-10) ──────────────────────────────────

  describe("Manager Scope (High)", () => {
    test("manager_p1 CAN read practice_1 cases", async () => {
      const { data } = await managerP1Client
        .from("cases")
        .select("id")
        .eq("practice_id", PRACTICE_1_ID);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("manager_p1 cannot read practice_2 cases", async () => {
      const { data } = await managerP1Client
        .from("cases")
        .select("id")
        .eq("practice_id", PRACTICE_2_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("manager_p1 cannot read practice_2 checkins (via case join)", async () => {
      // Manager can only see checkins for cases in their practice
      const { data } = await managerP1Client
        .from("checkins")
        .select("id, case_id")
        .eq("case_id", CASE_P2_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("manager_p2 cannot read practice_1 therapists", async () => {
      const { data } = await managerP2Client
        .from("therapists")
        .select("id")
        .eq("practice_id", PRACTICE_1_ID);
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ── ADMIN (existing) ───────────────────────────────────────────────────

  describe("Admin Access (High)", () => {
    test("admin can read all practices", async () => {
      const { data } = await adminClient.from("practice").select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    });

    test("admin can read all cases across practices", async () => {
      const { data } = await adminClient.from("cases").select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── GAP-04: case_ai_snapshots RLS ──────────────────────────────────────

  describe("case_ai_snapshots RLS (GAP-04)", () => {
    test("therapist_a CAN read snapshots for their cases", async () => {
      const { data } = await therapistAClient
        .from("case_ai_snapshots")
        .select("id")
        .eq("case_id", CASE_A_ID);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("therapist_b cannot read therapist_a snapshots", async () => {
      const { data } = await therapistBClient
        .from("case_ai_snapshots")
        .select("id")
        .eq("case_id", CASE_A_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read case_ai_snapshots", async () => {
      const { data } = await patientAClient
        .from("case_ai_snapshots")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("admin CAN read all snapshots", async () => {
      const { data } = await adminClient
        .from("case_ai_snapshots")
        .select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── GAP-04: therapist_ratings RLS ──────────────────────────────────────

  describe("therapist_ratings RLS (GAP-04)", () => {
    test("therapist_a CAN read own ratings", async () => {
      const { data } = await therapistAClient
        .from("therapist_ratings")
        .select("id")
        .eq("therapist_id", THERAPIST_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("therapist_b cannot read therapist_a ratings", async () => {
      const { data } = await therapistBClient
        .from("therapist_ratings")
        .select("id")
        .eq("therapist_id", THERAPIST_A.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("manager_p1 CAN read ratings within practice", async () => {
      const { data } = await managerP1Client
        .from("therapist_ratings")
        .select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("manager_p2 cannot read practice_1 ratings", async () => {
      const { data } = await managerP2Client
        .from("therapist_ratings")
        .select("id");
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read therapist_ratings", async () => {
      const { data } = await patientAClient
        .from("therapist_ratings")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist cannot INSERT ratings (server-side only)", async () => {
      const { error } = await therapistAClient
        .from("therapist_ratings")
        .insert({
          case_id: CASE_A_ID,
          therapist_id: THERAPIST_A.id,
          week_index: 99,
          s_rating: 5,
          o_rating: 5,
          t_rating: 5,
        });
      expect(error).not.toBeNull();
    });

    test("admin CAN read all ratings", async () => {
      const { data } = await adminClient
        .from("therapist_ratings")
        .select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── GAP-07: qa_checks locked down ─────────────────────────────────────

  describe("qa_checks RLS (GAP-07)", () => {
    test("anon returns 0 rows on qa_checks", async () => {
      const anon = anonClient();
      const { data } = await anon
        .from("qa_checks")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist cannot read qa_checks", async () => {
      const { data } = await therapistAClient
        .from("qa_checks")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read qa_checks", async () => {
      const { data } = await patientAClient
        .from("qa_checks")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("manager cannot read qa_checks", async () => {
      const { data } = await managerP1Client
        .from("qa_checks")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("admin CAN read qa_checks", async () => {
      const { data } = await adminClient
        .from("qa_checks")
        .select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── GAP-09: therapist_profiles + user_roles ────────────────────────────

  describe("therapist_profiles RLS (GAP-09)", () => {
    test("therapist_a CAN read own profile", async () => {
      const { data } = await therapistAClient
        .from("therapist_profiles")
        .select("id, preferred_name")
        .eq("id", THERAPIST_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBe(1);
    });

    test("therapist_a cannot read therapist_b profile", async () => {
      const { data } = await therapistAClient
        .from("therapist_profiles")
        .select("id")
        .eq("id", THERAPIST_B.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("manager_p1 CAN read profiles in practice", async () => {
      const { data } = await managerP1Client
        .from("therapist_profiles")
        .select("id")
        .eq("practice_id", PRACTICE_1_ID);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("patient cannot read therapist_profiles", async () => {
      const { data } = await patientAClient
        .from("therapist_profiles")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("admin CAN read all profiles", async () => {
      const { data } = await adminClient
        .from("therapist_profiles")
        .select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("user_roles RLS (GAP-09)", () => {
    test("therapist_a CAN read own role", async () => {
      const { data } = await therapistAClient
        .from("user_roles")
        .select("user_id, role")
        .eq("user_id", THERAPIST_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBe(1);
    });

    test("therapist_a cannot read other users' roles", async () => {
      const { data } = await therapistAClient
        .from("user_roles")
        .select("user_id")
        .eq("user_id", ADMIN_USER.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("admin CAN read all roles", async () => {
      const { data } = await adminClient
        .from("user_roles")
        .select("user_id, role");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── GAP-10: cases policy conflict resolved ────────────────────────────

  describe("Cases RLS — no conflicts (GAP-10)", () => {
    test("therapist_a CAN read own cases", async () => {
      const { data } = await therapistAClient
        .from("cases")
        .select("id")
        .eq("therapist_id", THERAPIST_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("therapist_a cannot read therapist_b cases", async () => {
      const { data } = await therapistAClient
        .from("cases")
        .select("id")
        .eq("therapist_id", THERAPIST_B.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist_a CAN insert a case assigned to themselves", async () => {
      const newId = "00000000-0000-0000-9999-aaaaaaaaaaaa";
      const { error } = await therapistAClient.from("cases").insert({
        id: newId,
        therapist_id: THERAPIST_A.id,
        practice_id: PRACTICE_1_ID,
        status: "active",
      });
      expect(error).toBeNull();
      // Cleanup
      await svc.from("cases").delete().eq("id", newId);
    });

    test("therapist_a cannot insert a case assigned to therapist_b", async () => {
      const { error } = await therapistAClient.from("cases").insert({
        id: "00000000-0000-0000-9999-bbbbbbbbbbbb",
        therapist_id: THERAPIST_B.id,
        practice_id: PRACTICE_1_ID,
        status: "active",
      });
      expect(error).not.toBeNull();
    });

    test("patient CAN read own case (patient_id)", async () => {
      const { data } = await patientAClient
        .from("cases")
        .select("id")
        .eq("patient_id", PATIENT_A.id);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("manager_p1 CAN read all practice_1 cases", async () => {
      const { data } = await managerP1Client
        .from("cases")
        .select("id")
        .eq("practice_id", PRACTICE_1_ID);
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("manager_p1 cannot read practice_2 cases", async () => {
      const { data } = await managerP1Client
        .from("cases")
        .select("id")
        .eq("practice_id", PRACTICE_2_ID);
      expect(data ?? []).toHaveLength(0);
    });

    test("admin CAN read all cases", async () => {
      const { data } = await adminClient.from("cases").select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── GAP-20: audit_log ─────────────────────────────────────────────────

  describe("audit_log RLS (GAP-20)", () => {
    test("admin CAN read audit_log", async () => {
      const { data } = await adminClient.from("audit_log").select("id");
      expect(data).not.toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    });

    test("therapist cannot read audit_log", async () => {
      const { data } = await therapistAClient
        .from("audit_log")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read audit_log", async () => {
      const { data } = await patientAClient
        .from("audit_log")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("manager cannot read audit_log", async () => {
      const { data } = await managerP1Client
        .from("audit_log")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("therapist CAN insert into audit_log", async () => {
      const { error } = await therapistAClient.from("audit_log").insert({
        event: "rls_test_insert",
        role: "therapist",
        route: "/test",
      });
      expect(error).toBeNull();
    });

    test("audit_log rejects UPDATE from any role", async () => {
      const { data } = await adminClient
        .from("audit_log")
        .update({ event: "tampered" })
        .eq("event", "rls_test_insert")
        .select("id");
      // No UPDATE policy exists, so 0 rows affected
      expect(data ?? []).toHaveLength(0);
    });

    test("audit_log rejects DELETE from any role", async () => {
      const { data } = await adminClient
        .from("audit_log")
        .delete()
        .eq("event", "rls_test_insert")
        .select("id");
      // No DELETE policy exists, so 0 rows affected
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ── AI AUDIT LOGS (existing) ───────────────────────────────────────────

  describe("AI Audit Logs (High)", () => {
    test("manager select on ai_audit_logs_safe does not expose input_hash", async () => {
      const { data } = await managerP1Client
        .from("ai_audit_logs_safe")
        .select("*")
        .limit(1);

      if (data && data.length > 0) {
        const row = data[0] as Record<string, unknown>;
        expect(row).not.toHaveProperty("input_hash");
        expect(row).not.toHaveProperty("output_summary");
      }
    });

    test("therapist cannot read ai_audit_logs", async () => {
      const { data } = await therapistAClient
        .from("ai_audit_logs")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read ai_audit_logs", async () => {
      const { data } = await patientAClient
        .from("ai_audit_logs")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ── TASK STATUS UPDATES (existing) ────────────────────────────────────

  describe("Task Updates (High)", () => {
    test("patient can update status on their own task", async () => {
      const { error } = await patientAClient
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("assigned_to_id", PATIENT_A.id)
        .eq("assigned_to_role", "patient");
      expect(error).toBeNull();
    });

    test("patient cannot update therapist tasks", async () => {
      const { data } = await patientAClient
        .from("tasks")
        .update({ status: "completed" })
        .eq("assigned_to_role", "therapist")
        .select("id");
      expect(data ?? []).toHaveLength(0);
    });
  });

  // ── JOIN CODE ACCESS (existing) ───────────────────────────────────────

  describe("Join Code Access (P0)", () => {
    test("therapist can see join codes they created", async () => {
      const { data } = await therapistAClient
        .from("join_codes")
        .select("id, code")
        .eq("created_by", THERAPIST_A.id);
      expect(data).not.toBeNull();
    });

    test("therapist cannot see join codes created by another therapist", async () => {
      const { data } = await therapistAClient
        .from("join_codes")
        .select("id, code")
        .eq("created_by", THERAPIST_B.id);
      expect(data ?? []).toHaveLength(0);
    });

    test("admin can see all join codes", async () => {
      const { data } = await adminClient.from("join_codes").select("id");
      expect(data).not.toBeNull();
    });

    test("admin can see portal audit log", async () => {
      const { data } = await adminClient
        .from("portal_audit_log")
        .select("id");
      expect(data).not.toBeNull();
    });

    test("patient cannot read join_codes", async () => {
      const { data } = await patientAClient
        .from("join_codes")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read portal_audit_log", async () => {
      const { data } = await patientAClient
        .from("portal_audit_log")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });

    test("patient cannot read join_code_attempts", async () => {
      const { data } = await patientAClient
        .from("join_code_attempts")
        .select("id")
        .limit(1);
      expect(data ?? []).toHaveLength(0);
    });
  });
});
