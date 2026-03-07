// lib/rateLimit.ts
// Sliding-window rate limiter backed by Upstash Redis.
// Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ── Redis-backed limiter (Upstash) ──────────────────────────────────────────

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const key = `${maxRequests}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    const windowSec = Math.ceil(windowMs / 1000);
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
      prefix: "rl",
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

// ── In-memory fallback (single-instance only) ──────────────────────────────

interface MemoryEntry { timestamps: number[] }
const memStore = new Map<string, MemoryEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function memoryCleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of memStore) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) memStore.delete(key);
  }
}

function checkMemoryRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  memoryCleanup(windowMs);
  const now = Date.now();
  const cutoff = now - windowMs;
  let entry = memStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memStore.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  if (entry.timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.timestamps[0] + windowMs };
  }
  entry.timestamps.push(now);
  return { allowed: true, remaining: maxRequests - entry.timestamps.length, resetAt: now + windowMs };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  // Synchronous check — Redis path is async, so we use the memory fallback
  // in the synchronous codepath. Use checkRateLimitAsync for Redis.
  return checkMemoryRateLimit(key, maxRequests, windowMs);
}

export async function checkRateLimitAsync(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(maxRequests, windowMs);
  if (!limiter) {
    return checkMemoryRateLimit(key, maxRequests, windowMs);
  }

  try {
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  } catch (e) {
    // Redis unavailable — fall back to memory
    console.warn("[rateLimit] Upstash unavailable, falling back to memory:", (e as Error).message);
    return checkMemoryRateLimit(key, maxRequests, windowMs);
  }
}
