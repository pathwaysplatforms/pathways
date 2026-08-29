import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  enforceRateLimit,
  resetRateLimits,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";

function makeReq(headers: Record<string, string>): NextRequest {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit (happy path)", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(checkRateLimit("k", opts).success).toBe(true);
    expect(checkRateLimit("k", opts).success).toBe(true);
    const third = checkRateLimit("k", opts);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("denies the request that exceeds the limit (edge case)", () => {
    const opts = { limit: 2, windowMs: 1000 };
    checkRateLimit("k", opts);
    checkRateLimit("k", opts);
    const denied = checkRateLimit("k", opts);
    expect(denied.success).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const opts = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("k", opts).success).toBe(true);
    expect(checkRateLimit("k", opts).success).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit("k", opts).success).toBe(true);
    vi.useRealTimers();
  });

  it("tracks distinct keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("a", opts).success).toBe(true);
    expect(checkRateLimit("b", opts).success).toBe(true);
    expect(checkRateLimit("a", opts).success).toBe(false);
  });
});

describe("enforceRateLimit (no Upstash env → in-memory fallback)", () => {
  beforeEach(() => resetRateLimits());

  it("allows and then denies once the limit is exceeded", async () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect((await enforceRateLimit("e", opts)).success).toBe(true);
    expect((await enforceRateLimit("e", opts)).success).toBe(false);
  });
});

describe("getClientIp", () => {
  it("uses the first hop of x-forwarded-for", () => {
    expect(getClientIp(makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(makeReq({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP header is present (error case)", () => {
    expect(getClientIp(makeReq({}))).toBe("unknown");
  });
});

describe("rateLimitHeaders", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => vi.useRealTimers());

  it("emits standard headers without Retry-After when allowed", () => {
    const headers = rateLimitHeaders({ success: true, limit: 5, remaining: 4, resetAt: Date.now() + 1000 });
    expect(headers["RateLimit-Limit"]).toBe("5");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("includes Retry-After when denied", () => {
    const headers = rateLimitHeaders({ success: false, limit: 5, remaining: 0, resetAt: Date.now() + 2000 });
    expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(1);
  });
});
