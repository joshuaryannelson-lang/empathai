import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo/demoMode";
import { demoPractice } from "@/lib/demo/demoData";

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

export async function GET(request: Request) {
  if (isDemoMode(request.url)) {
    return NextResponse.json({ data: [demoPractice], error: null });
  }

  // Check for manager_id param — if present, scope practices to their assignments
  const { searchParams } = new URL(request.url);
  const managerId = searchParams.get("manager_id");

  if (managerId) {
    // Fetch only practices this manager is assigned to
    const { data: assignments, error: aErr } = await supabase
      .from("manager_practice_assignments")
      .select("practice_id")
      .eq("manager_id", managerId);

    if (aErr) {
      return NextResponse.json({ data: null, error: aErr }, { status: 500 });
    }

    const practiceIds = (assignments ?? []).map((a: { practice_id: string }) => a.practice_id);
    if (practiceIds.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    const { data, error } = await supabase
      .from("practice")
      .select("id, name")
      .in("id", practiceIds)
      .order("name");

    if (error) {
      return NextResponse.json({ data: null, error }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], error: null });
  }

  // No manager_id — return all practices (admin view)
  const { data, error } = await supabase
    .from("practice")
    .select("id, name")
    .order("name");

  if (error) {
    return NextResponse.json({ data: null, error }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [], error: null });
}