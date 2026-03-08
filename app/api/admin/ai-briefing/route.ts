import { NextResponse } from "next/server";
import { requireRole, isAuthError, logUnauthorizedAccess, getClientIp } from "@/lib/apiAuth";
import { checkRateLimitAsync } from "@/lib/rateLimit";
import { logAiCall, hashPrompt } from "@/lib/services/audit";
import { checkAiCostCeiling } from "@/lib/aiCostCeiling";

export async function POST(req: Request) {
  const auth = await requireRole("admin");
  if (isAuthError(auth)) {
    await logUnauthorizedAccess("/api/admin/ai-briefing", null, getClientIp(req));
    return auth;
  }

  // ── Rate limiting: admin 60/hr ──
  const rl = await checkRateLimitAsync(`ai:admin-briefing:${auth.user_id ?? "admin"}`, 60, 3600_000);
  if (!rl.allowed) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return new NextResponse(
      JSON.stringify({ data: null, error: { message: "rate_limit_exceeded", retryAfter: retryAfter > 0 ? retryAfter : 60 } }),
      { status: 429, headers: { "Retry-After": String(retryAfter > 0 ? retryAfter : 60), "Content-Type": "application/json" } },
    );
  }

  // ── Cost ceiling: $25/month ──
  const costCheck = await checkAiCostCeiling();
  if (!costCheck.allowed) {
    return NextResponse.json({ data: null, error: { message: "AI limit reached — monthly cost ceiling exceeded" } }, { status: 503 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });

  const { prompt } = await req.json().catch(() => ({}));
  if (!prompt || typeof prompt !== "string")
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const model = "claude-haiku-4-5-20251001";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    await logAiCall({
      service: "admin-briefing",
      case_code: auth.user_id ?? "admin",
      triggered_by: auth.user_id ?? "admin",
      input_hash: hashPrompt(prompt),
      model,
      tokens_used: 0,
      error: true,
    });
    return NextResponse.json({ error: json?.error?.message ?? "Anthropic API error" }, { status: res.status });
  }

  // ── Audit log: after confirmed success ──
  const tokensEstimated = Math.ceil(prompt.length / 4);
  await logAiCall({
    service: "admin-briefing",
    case_code: auth.user_id ?? "admin",
    triggered_by: auth.user_id ?? "admin",
    input_hash: hashPrompt(prompt),
    model,
    tokens_used: tokensEstimated,
  });

  const text: string = json?.content?.[0]?.text ?? "";
  return NextResponse.json({ data: { text } });
}
