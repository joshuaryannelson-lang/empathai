// app/api/cases/[id]/ths/route.ts
// Patient-level THS: deterministic score + optional LLM narrative.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from "@/lib/supabase";
import { bad, getIdFromContext, ok, RouteContextWithId } from "@/lib/route-helpers";
import { isDemoMode } from "@/lib/demo/demoMode";
import { checkRateLimit } from "@/lib/rateLimit";
import { calculateTHS, type THSInput } from "@/lib/ai/thsScoring";
import { buildTHSNarrativePrompt, validateNarrative } from "@/lib/ai/thsNarrativePrompt";
import { hashPrompt, logAiCall } from "@/lib/services/audit";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 200;
const INPUT_COST_PER_TOKEN = 1 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 5 / 1_000_000;

export async function GET(_req: Request, ctx: RouteContextWithId) {
  const caseId = await getIdFromContext(ctx);
  if (!caseId) return bad("Missing case id");

  if (isDemoMode(_req.url)) {
    return ok({
      score: 7.2,
      components: { W: 7, S: 8, O: 7, T: 6 },
      confidence: "high",
      narrative: "This period's score reflects solid session engagement and steady self-reported wellbeing. Goal progress is the primary driver, with room for growth in therapeutic alliance.",
      week_index: null,
    });
  }

  // ── Gather component data ──
  // W: average check-in rating
  const checkinsRes = await supabaseAdmin
    .from("checkins")
    .select("score")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (checkinsRes.error) return bad(checkinsRes.error.message, 400);

  const scores = (checkinsRes.data ?? [])
    .map((c: any) => c.score)
    .filter((s: any) => typeof s === "number");

  const W = scores.length > 0
    ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
    : null;

  // S, O, T: from case metadata (therapist-submitted)
  // These would come from a therapist_ratings table or case metadata.
  // For pilot, accept them as query params or return null if not yet submitted.
  const url = new URL(_req.url);
  const S = url.searchParams.get("S") ? Number(url.searchParams.get("S")) : null;
  const O = url.searchParams.get("O") ? Number(url.searchParams.get("O")) : null;
  const T = url.searchParams.get("T") ? Number(url.searchParams.get("T")) : null;

  // ── Calculate THS (deterministic) ──
  const thsInput: THSInput = { W, S, O, T };
  const result = calculateTHS(thsInput);

  // ── Optional: generate narrative via LLM ──
  let narrative: string | null = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const wantNarrative = url.searchParams.get("narrative") !== "false";

  if (apiKey && wantNarrative && result.confidence !== "low") {
    const rl = checkRateLimit(`ai:ths:${caseId}`, 20, 86400_000);
    if (rl.allowed) {
      try {
        const prompt = buildTHSNarrativePrompt(result);
        const startTime = Date.now();

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const json = await res.json();
        if (res.ok) {
          const rawNarrative = json?.content?.[0]?.text ?? "";
          const violations = validateNarrative(rawNarrative);
          narrative = violations.length === 0
            ? rawNarrative
            : "Score summary is available above. Narrative could not be generated for this period.";

          const promptTokens = json?.usage?.input_tokens ?? 0;
          const completionTokens = json?.usage?.output_tokens ?? 0;
          const cost = (promptTokens * INPUT_COST_PER_TOKEN) + (completionTokens * OUTPUT_COST_PER_TOKEN);

          console.log(`[ths] case=${caseId} duration_ms=${Date.now() - startTime} tokens=${completionTokens}`);

          await logAiCall({
            service: "ths-scoring",
            case_code: caseId,
            triggered_by: "therapist",
            input_hash: hashPrompt(prompt),
            output_summary: (narrative ?? "").slice(0, 100),
            model: MODEL,
            tokens_used: promptTokens + completionTokens,
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            estimated_cost_usd: cost,
          });
        }
      } catch (e) {
        console.error("[ths] Narrative generation failed:", e);
      }
    }
  }

  return ok({
    score: result.score,
    components: result.components,
    confidence: result.confidence,
    narrative,
    week_index: null,
  });
}
