// app/api/cases/[id]/session-prep/route.ts
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  const caseRes = await supabase.from("cases").select("*").eq("id", caseId).single();
  if (caseRes.error) return bad(caseRes.error.message, 400, caseRes.error);

  const latestCheckinRes = await supabase
    .from("checkins")
    .select("*")
    .eq("case_id", caseId)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const goalsRes = await supabase
    .from("goals")
    .select("*")
    .eq("case_id", caseId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (latestCheckinRes.error) return bad(latestCheckinRes.error.message, 400, latestCheckinRes.error);
  if (goalsRes.error) return bad(goalsRes.error.message, 400, goalsRes.error);

  return ok({
    case: caseRes.data,
    latest_checkin: latestCheckinRes.data ?? null,
    active_goals: goalsRes.data ?? [],
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return bad("Anthropic API key not configured", 500);

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") return bad("prompt is required", 400);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 350,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok) return bad(json?.error?.message ?? "Anthropic API error", res.status);

  const text: string = json?.content?.[0]?.text ?? "";
  return ok({ text });
}