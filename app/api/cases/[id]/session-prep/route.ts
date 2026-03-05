// app/api/cases/[id]/session-prep/route.ts
import { supabase } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getDemoSessionPrep } from "@/lib/demo/demoAI";

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  const caseRes = await supabase.from("cases").select("id, title, status, created_at, patient_id, therapist_id, practice_id").eq("id", caseId).single();
  if (caseRes.error) return bad(caseRes.error.message, 400, caseRes.error);

  // Fetch last 4 checkins (not just 1) for richer context
  const checkinsRes = await supabase
    .from("checkins")
    .select("id, score, mood, created_at, note, notes, week_start")
    .eq("case_id", caseId)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);

  const goalsRes = await supabase
    .from("goals")
    .select("id, title, status, target_date")
    .eq("case_id", caseId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (checkinsRes.error) return bad(checkinsRes.error.message, 400, checkinsRes.error);
  if (goalsRes.error) return bad(goalsRes.error.message, 400, goalsRes.error);

  return ok({
    case: caseRes.data,
    checkins: checkinsRes.data ?? [],
    latest_checkin: (checkinsRes.data ?? [])[0] ?? null,
    active_goals: goalsRes.data ?? [],
  });
}

export async function POST(req: Request) {
  // Demo mode: return canned session prep (non-streaming)
  if (isDemoMode(req.url)) {
    const match = req.url.match(/\/api\/cases\/([^/]+)\/session-prep/);
    const caseId = match?.[1] ?? "";
    return ok({ text: getDemoSessionPrep(caseId) });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return bad("Anthropic API key not configured", 500);

  const body = await req.json().catch(() => ({}));
  const { prompt, stream } = body as { prompt?: string; stream?: boolean };
  if (!prompt || typeof prompt !== "string") return bad("prompt is required", 400);

  // Non-streaming mode (fallback)
  if (!stream) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const json = await res.json();
    if (!res.ok) return bad(json?.error?.message ?? "Anthropic API error", res.status);

    const text: string = json?.content?.[0]?.text ?? "";
    return ok({ text });
  }

  // Streaming mode
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const errJson = await anthropicRes.json().catch(() => ({}));
    return bad((errJson as Record<string, unknown>)?.error?.toString() ?? "Anthropic API error", anthropicRes.status);
  }

  // Pipe SSE from Anthropic to client
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body?.getReader();
      if (!reader) { controller.close(); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.type === "content_block_delta" && event.delta?.text) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
