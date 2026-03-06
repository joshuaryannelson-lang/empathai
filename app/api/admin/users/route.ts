// app/api/admin/users/route.ts
// GET: list users filtered by role (admin only)
// Minimal endpoint for the manager assignment combobox.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function ok(data: unknown) { return NextResponse.json({ data, error: null }); }
function bad(msg: string, status = 400) { return NextResponse.json({ data: null, error: { message: msg } }, { status }); }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (!role) return bad("role query param required");

  try {
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return bad(error.message, 500);

    const filtered = (usersData?.users ?? [])
      .filter(u => u.app_metadata?.role === role)
      .map(u => ({
        id: u.id,
        email: u.email ?? "",
        first_name: (u.user_metadata?.first_name as string) ?? null,
        last_name: (u.user_metadata?.last_name as string) ?? null,
      }));

    return ok(filtered);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to list users";
    return bad(msg, 500);
  }
}
