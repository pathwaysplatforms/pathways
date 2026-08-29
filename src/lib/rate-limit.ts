import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter with a distributed backend when configured, and an in-process
 * fallback otherwise.
 *
 * When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set, limits are enforced
 * globally across all serverless instances via Upstash Redis (sliding window). When
 * they are absent (e.g. local dev or CI), we fall back to a per-instance in-memory
 * fixed window — good enough to blunt a single-source flood locally, but not a global
 * guarantee. Prefer configuring Upstash in every deployed environment.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Maximum number of allowed requests within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether this request is allowed. */
  success: boolean;
  /** The configured request ceiling for the window. */
  limit: number;
  /** Requests remaining in the current window (never negative). */
  remaining: number;
  /** Epoch milliseconds when the window resets. */
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

/**
 * When the map grows past this many keys we sweep expired windows. Bounds memory
 * against a flood of unique keys (e.g. spoofed X-Forwarded-For values).
 */
const SWEEP_THRESHOLD = 10_000;

/** Drop every window whose reset time has already passed. */
function sweepExpired(now: number): void {
  for (const [key, state] of buckets) {
    if (state.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record one hit against `key` and report whether it is within the limit.
 * A fresh window starts on the first hit and on the first hit after `resetAt`.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) sweepExpired(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, limit: options.limit, remaining: options.limit - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, options.limit - existing.count);
  return {
    success: existing.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: existing.resetAt,
  };
}

/** Clear all rate-limit state. Intended for tests. */
export function resetRateLimits(): void {
  buckets.clear();
}

// ─── Distributed backend (Upstash Redis) with in-memory fallback ────────────────

let redisClient: Redis | null = null;
let redisResolved = false;

/** Lazily build a Redis client from env, or return null when Upstash is not configured. */
function getRedis(): Redis | null {
  if (redisResolved) return redisClient;
  redisResolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redisClient = new Redis({ url, token });
  }
  return redisClient;
}

const limiterCache = new Map<string, Ratelimit>();

/** Memoize one Upstash Ratelimit per (limit, windowMs) pair, or null if no Redis. */
function getUpstashLimiter(options: RateLimitOptions): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${options.limit}:${options.windowMs}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.limit, `${options.windowMs} ms`),
      prefix: "pw-rl",
      analytics: false,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

/**
 * Enforce a rate limit for `key`, using Upstash Redis when configured and the
 * in-memory limiter otherwise. Always prefer this over `checkRateLimit` in request
 * handlers so limits hold across serverless instances in production.
 */
export async function enforceRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(options);
  if (limiter) {
    const res = await limiter.limit(key);
    return {
      success: res.success,
      limit: res.limit,
      remaining: Math.max(0, res.remaining),
      resetAt: res.reset,
    };
  }
  return checkRateLimit(key, options);
}

/**
 * Best-effort client IP extraction for keying rate limits. Prefers the first hop
 * in X-Forwarded-For (set by Vercel's proxy), then X-Real-IP, falling back to a
 * constant so the limiter still degrades to a global cap when no IP is present.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Standard rate-limit response headers for a given result, suitable for spreading
 * into a Response init. Includes Retry-After (seconds) when the request was denied.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.success) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
  }
  return headers;
}
