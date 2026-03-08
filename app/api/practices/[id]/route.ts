import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(ctx.params);
  const id = resolvedParams?.id;
  if (!id) return NextResponse.json({ error: "Missing practice id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("practice")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  // Next can provide params sync or async depending on version/runtime
  const resolvedParams = await Promise.resolve(ctx.params);
  const id = resolvedParams?.id;

  if (!id) {
    return NextResponse.json(
      { error: "Missing practice id", params: resolvedParams },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("practice")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Supabase returns PGRST116 when no rows match (not found)
    const isNotFound = error.code === "PGRST116" || error.message?.includes("0 rows");
    return NextResponse.json(
      { data: null, error: { message: isNotFound ? "Practice not found" : error.message } },
      { status: isNotFound ? 404 : 500 },
    );
  }

  return NextResponse.json({ data, error: null });
}