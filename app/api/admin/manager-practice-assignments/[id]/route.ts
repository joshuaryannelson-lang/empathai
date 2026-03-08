// app/api/admin/manager-practice-assignments/[id]/route.ts
// DELETE: remove an assignment (admin only)
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireRole, isAuthError, logUnauthorizedAccess, getClientIp } from "@/lib/apiAuth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ok(data: unknown, status = 200) { return NextResponse.json({ data, error: null }, { status }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) {
    await logUnauthorizedAccess("/api/admin/manager-practice-assignments/[id]", null, getClientIp(_request));
    return auth;
  }

  const { id } = await params;
  if (!id || !UUID_RE.test(id)) return bad("valid assignment id required");

  // Fetch assignment details for audit log before deleting
  const { data: existing } = await supabase
    .from("manager_practice_assignments")
    .select("id, manager_id, practice_id")
    .eq("id", id)
    .single();

  if (!existing) return bad("assignment not found", 404);

  const { error } = await supabase
    .from("manager_practice_assignments")
    .delete()
    .eq("id", id);

  if (error) return bad(error.message, 500);

  // Audit log
  try {
    await supabase.from("portal_audit_log").insert({
      event: "assignment_removed",
      case_code: null,
      metadata: {
        assignment_id: existing.id,
        manager_id: existing.manager_id,
        practice_id: existing.practice_id,
      },
    });
  } catch {
    // Non-critical
  }

  return ok({ deleted: true });
}
