// app/api/admin/manager-practice-assignments/route.ts
// GET: list assignments (by practice_id or manager_id)
// POST: create a new assignment (admin only)
import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const practiceId = searchParams.get("practice_id");
  const managerId = searchParams.get("manager_id");

  if (!practiceId && !managerId) {
    return bad("practice_id or manager_id query param required");
  }

  let query = supabase
    .from("manager_practice_assignments")
    .select("id, manager_id, practice_id, assigned_at");

  if (practiceId) {
    if (!UUID_RE.test(practiceId)) return bad("invalid practice_id");
    query = query.eq("practice_id", practiceId);
  }
  if (managerId) {
    if (!UUID_RE.test(managerId)) return bad("invalid manager_id");
    query = query.eq("manager_id", managerId);
  }

  const { data, error } = await query.order("assigned_at", { ascending: false });
  if (error) return bad(error.message, 500);

  // Enrich with user metadata from auth.users via admin client
  const managerIds = [...new Set((data ?? []).map((a: { manager_id: string }) => a.manager_id))];
  const userLookup: Record<string, { email: string; first_name: string | null }> = {};

  if (managerIds.length > 0) {
    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      for (const u of usersData?.users ?? []) {
        if (managerIds.includes(u.id)) {
          userLookup[u.id] = {
            email: u.email ?? "",
            first_name: (u.user_metadata?.first_name as string) ?? null,
          };
        }
      }
    } catch {
      // If admin client unavailable, return assignments without user metadata
    }
  }

  const enriched = (data ?? []).map((a: { id: string; manager_id: string; practice_id: string; assigned_at: string }) => ({
    ...a,
    manager: userLookup[a.manager_id] ?? { email: "", first_name: null },
  }));

  return ok(enriched);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const managerId = typeof body?.manager_id === "string" ? body.manager_id.trim() : "";
  const practiceId = typeof body?.practice_id === "string" ? body.practice_id.trim() : "";

  if (!managerId || !UUID_RE.test(managerId)) return bad("valid manager_id required");
  if (!practiceId || !UUID_RE.test(practiceId)) return bad("valid practice_id required");

  // Validate practice exists
  const { data: practice, error: pErr } = await supabase
    .from("practice")
    .select("id")
    .eq("id", practiceId)
    .single();
  if (pErr || !practice) return bad("practice not found", 404);

  // Validate manager exists and has role=manager
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(managerId);
    const role = userData?.user?.app_metadata?.role;
    if (role !== "manager") return bad("user is not a manager", 400);
  } catch {
    return bad("could not verify manager user", 500);
  }

  // Insert assignment
  const { data, error } = await supabase
    .from("manager_practice_assignments")
    .insert({ manager_id: managerId, practice_id: practiceId, assigned_by: managerId })
    .select("id, manager_id, practice_id, assigned_at")
    .single();

  if (error) {
    if (error.code === "23505") return bad("manager already assigned to this practice", 409);
    return bad(error.message, 500);
  }

  // Audit log
  try {
    await supabase.from("portal_audit_log").insert({
      event: "assignment_created",
      case_code: null,
      metadata: { manager_id: managerId, practice_id: practiceId, assignment_id: data.id },
    });
  } catch {
    // Non-critical — don't fail the request
  }

  return ok(data, 201);
}
