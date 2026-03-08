// app/api/cases/[id]/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoCase } from "@/lib/demo/demoData";
import { requireAuth, isAuthError, verifyCaseOwnership } from "@/lib/apiAuth";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const id = await getIdFromContext(ctx);
  if (!id) return bad("Missing case id");

  if (isDemoMode(_req.url)) {
    const c = getDemoCase(id);
    if (!c) return bad("Case not found", 404);
    return ok(c);
  }

  const { data, error } = await supabase.from("cases").select("*").eq("id", id).single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}

export async function PATCH(req: Request, ctx: RouteContextWithId) {
  if (isDemoMode(req.url)) return bad("Demo mode — changes are disabled", 403);

  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const id = await getIdFromContext(ctx);
  if (!id) return bad("Missing case id");

  // Ownership check: therapist must be assigned to this case (admin bypasses)
  const ownershipErr = await verifyCaseOwnership(id, auth);
  if (ownershipErr) return ownershipErr;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body");
  }

  const patch: Record<string, any> = {};
  if (body.title !== undefined) patch.title = String(body.title).trim();
  if (body.status !== undefined) patch.status = String(body.status).trim();
  if (body.practice_id !== undefined) patch.practice_id = body.practice_id || null;
  if (body.therapist_id !== undefined) patch.therapist_id = body.therapist_id || null;
  if (body.clinical_notes !== undefined) patch.clinical_notes = String(body.clinical_notes);
  if (body.dsm_codes !== undefined) {
    if (!Array.isArray(body.dsm_codes)) return bad("dsm_codes must be an array");
    if (body.dsm_codes.length > 5) return bad("Maximum 5 DSM codes allowed");
    patch.dsm_codes = body.dsm_codes.map((c: unknown) => String(c).trim()).filter(Boolean);
  }

  if (Object.keys(patch).length === 0) {
    return bad("No fields to update (send title, status, practice_id, therapist_id, clinical_notes, and/or dsm_codes)");
  }

  // Capture previous therapist for audit if assignment is changing
  let previousTherapistId: string | null = null;
  if (patch.therapist_id !== undefined) {
    const prev = await supabase.from("cases").select("therapist_id").eq("id", id).single();
    previousTherapistId = prev.data?.therapist_id ?? null;
  }

  const { data, error } = await supabase
    .from("cases")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return bad(error.message, 400, error);

  // Audit log for assignment changes
  if (patch.therapist_id !== undefined && patch.therapist_id !== previousTherapistId) {
    await supabase.from("audit_log").insert({
      event: "case_assigned",
      case_id: id,
      user_id: auth.user_id,
      role: auth.role,
      route: `/api/cases/${id}`,
      metadata: {
        old_therapist_id: previousTherapistId,
        new_therapist_id: patch.therapist_id,
      },
    }).then(({ error: auditErr }) => {
      if (auditErr) console.error(`[cases] audit log error: ${auditErr.message}`);
    });
  }

  return ok(data);
}

export async function DELETE(_req: Request, ctx: RouteContextWithId) {
  if (isDemoMode(_req.url)) return bad("Demo mode — changes are disabled", 403);

  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const id = await getIdFromContext(ctx);
  if (!id) return bad("Missing case id");

  // Ownership check
  const ownershipErr = await verifyCaseOwnership(id, auth);
  if (ownershipErr) return ownershipErr;

  const { data, error } = await supabase.from("cases").delete().eq("id", id).select().single();

  if (error) return bad(error.message, 400, error);
  return ok(data);
}
