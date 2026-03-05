import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("practice")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ data: null, error }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function GET() {
  const { data, error } = await supabase
    .from("practice") // table name from Supabase
    .select("id, name")
    .order("name");

  if (error) {
    return NextResponse.json(
      { data: null, error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: data ?? [],
    error: null,
  });
}