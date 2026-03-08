// app/api/cases/[id]/ratings/route.ts
// Therapist session ratings — POST to save, GET to retrieve.
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { requireAuth, isAuthError, verifyCaseOwnership } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  const url = new URL(req.url);
  const weekIndex = url.searchParams.get("week_index");

  let query = supabase
    .from("therapist_ratings")
    .select("id, case_id, therapist_id, week_index, s_rating, o_rating, t_rating, created_at, updated_at")
    .eq("case_id", caseId)
    .order("week_index", { ascending: false });

  if (weekIndex) {
    query = query.eq("week_index", Number(weekIndex));
  }

  const { data, error } = await query;
  if (error) return bad(error.message, 400);
  return ok(data ?? []);
}

export async function POST(req: Request, ctx: RouteContextWithId) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  // Ownership check
  const ownershipErr = await verifyCaseOwnership(caseId, auth);
  if (ownershipErr) return ownershipErr;

  const body = await req.json().catch(() => ({}));
  const { therapist_id, week_index, S, O, T } = body;

  if (!therapist_id) return bad("therapist_id required");
  if (typeof week_index !== "number") return bad("week_index (number) required");
  if (typeof S !== "number" || S < 0 || S > 10) return bad("S rating must be 0-10");
  if (typeof O !== "number" || O < 0 || O > 10) return bad("O rating must be 0-10");
  if (typeof T !== "number" || T < 0 || T > 10) return bad("T rating must be 0-10");

  const { data, error } = await supabase
    .from("therapist_ratings")
    .upsert(
      {
        case_id: caseId,
        therapist_id,
        week_index,
        s_rating: S,
        o_rating: O,
        t_rating: T,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_id,week_index" }
    )
    .select("id, case_id, therapist_id, week_index, s_rating, o_rating, t_rating, updated_at")
    .single();

  if (error) return bad(error.message, 400);
  return ok(data);
}
