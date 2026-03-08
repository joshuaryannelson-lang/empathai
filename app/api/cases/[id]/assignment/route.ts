// app/api/cases/[id]/assignment/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAuth, isAuthError, verifyCaseOwnership } from "@/lib/apiAuth";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { data: null, error: { message: "Missing case id" } },
      { status: 400 }
    );
  }

  // Ownership check (admin bypasses)
  const ownershipErr = await verifyCaseOwnership(id, auth);
  if (ownershipErr) return ownershipErr;

  const body = await req.json().catch(() => ({}));
  const therapist_id = body?.therapist_id;

  if (!therapist_id) {
    return NextResponse.json(
      { data: null, error: { message: "Missing therapist_id" } },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("cases")
    .update({ therapist_id })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ data: null, error }, { status: 400 });
  }

  return NextResponse.json({ data, error: null });
}
