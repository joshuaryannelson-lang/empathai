// lib/ai-cost-guard.ts
// Redis-backed AI cost circuit breaker.
// Falls back to Supabase-based check (lib/aiCostCeiling.ts) when Redis is unavailable.

import { getRedis } from "@/lib/redis";
import { checkAiCostCeiling } from "@/lib/aiCostCeiling";
import { safeLog } from "@/lib/logger";

const COST_CEILING_USD = 25;
const COST_ALERT_USD = 20;
const REDIS_KEY = "ai:spend:total";

/**
 * Check if AI spending is within the cost ceiling.
 * Uses Redis for fast atomic reads; falls back to Supabase query.
 */
export async function checkCostCeiling(): Promise<{ allowed: boolean; spend: number }> {
  try {
    const redis = getRedis();
    if (!redis) {
      // No Redis — fall back to Supabase-based check
      const fallback = await checkAiCostCeiling();
      return { allowed: fallback.allowed, spend: fallback.totalSpend };
    }

    const raw = await redis.get<string>(REDIS_KEY);
    const spend = raw !== null && raw !== undefined ? parseFloat(String(raw)) : 0;

    if (isNaN(spend)) {
      safeLog.warn("[ai-cost-guard] Invalid Redis value, falling back to Supabase");
      const fallback = await checkAiCostCeiling();
      return { allowed: fallback.allowed, spend: fallback.totalSpend };
    }

    if (spend >= COST_CEILING_USD) {
      safeLog.warn("[ai-cost-guard] Cost ceiling reached", {
        spend: spend.toFixed(4),
        ceiling: String(COST_CEILING_USD),
      });
      return { allowed: false, spend };
    }

    return { allowed: true, spend };
  } catch (e) {
    // Redis error — fall back to Supabase
    safeLog.warn("[ai-cost-guard] Redis error, falling back to Supabase", { error: String(e) });
    const fallback = await checkAiCostCeiling();
    return { allowed: fallback.allowed, spend: fallback.totalSpend };
  }
}

/**
 * Check if spending has crossed the alert threshold ($20).
 */
export async function checkCostAlert(): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;

    const raw = await redis.get<string>(REDIS_KEY);
    const spend = raw !== null && raw !== undefined ? parseFloat(String(raw)) : 0;
    return !isNaN(spend) && spend >= COST_ALERT_USD;
  } catch {
    return false;
  }
}

/**
 * Atomically increment the cumulative spend counter in Redis.
 */
export async function recordSpend(cost: number): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis || cost <= 0) return;

    await redis.incrbyfloat(REDIS_KEY, cost);
  } catch (e) {
    // Non-fatal — spend is still recorded in ai_audit_logs via Supabase
    safeLog.warn("[ai-cost-guard] Failed to record spend in Redis", { error: String(e) });
  }
}
