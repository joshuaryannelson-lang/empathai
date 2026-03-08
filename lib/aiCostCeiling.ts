// lib/aiCostCeiling.ts
// Monthly AI cost ceiling enforcement.
// Queries ai_audit_logs for total estimated_cost_usd this month.
// Returns { allowed: false } if cumulative spend exceeds $25.

import { supabaseAdmin } from "@/lib/supabase";

const MONTHLY_CEILING_USD = 25;

export async function checkAiCostCeiling(): Promise<{ allowed: boolean; totalSpend: number }> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data, error } = await supabaseAdmin
      .from("ai_audit_logs")
      .select("estimated_cost_usd")
      .gte("created_at", monthStart)
      .not("estimated_cost_usd", "is", null);

    if (error) {
      // If table doesn't exist or query fails, allow (fail-open for availability)
      console.warn("[aiCostCeiling] Query failed, allowing:", error.message);
      return { allowed: true, totalSpend: 0 };
    }

    const totalSpend = (data ?? []).reduce(
      (sum, row) => sum + (typeof row.estimated_cost_usd === "number" ? row.estimated_cost_usd : 0),
      0,
    );

    if (totalSpend >= MONTHLY_CEILING_USD) {
      console.warn(`[aiCostCeiling] Monthly ceiling reached: $${totalSpend.toFixed(2)} >= $${MONTHLY_CEILING_USD}`);
      return { allowed: false, totalSpend };
    }

    return { allowed: true, totalSpend };
  } catch (e) {
    console.warn("[aiCostCeiling] Exception, allowing:", e);
    return { allowed: true, totalSpend: 0 };
  }
}
