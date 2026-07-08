import type { NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { createGuestSession, getGuestSession } from "@/modules/guest/service";
import { PathwaysError, NotFoundError, safeErrorMessage } from "@/lib/errors";
import { enforceRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

/** Create a new guest session. Returns { session_token, expires_at }. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.guest.session.create.start" });

  // Rate limit token minting per IP — this is the entry point an attacker would
  // spam to obtain tokens for the (paid) AI guest-turn / match endpoints.
  const rl = await enforceRateLimit(`guest-session:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    log.warn({ action: "api.guest.session.create.rate_limited" });
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const session = await createGuestSession(log);
    log.info({ action: "api.guest.session.create.done" });
    return Response.json(
      { session_token: session.session_token, expires_at: session.expires_at },
      { status: 201 }
    );
  } catch (err) {
    const code = err instanceof PathwaysError ? err.code : "INTERNAL_ERROR";
    const status = err instanceof PathwaysError ? err.statusCode : 500;
    log.error({ action: "api.guest.session.create.error", error: String(err) });
    return Response.json({ error: { code, message: safeErrorMessage(err) } }, { status });
  }
}

/** Retrieve a guest session by token (query param). Returns the full session. */
export async function GET(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.guest.session.get.start" });

  const token = req.nextUrl.searchParams.get("token") ?? "";

  try {
    const session = await getGuestSession(token, log);
    log.info({ action: "api.guest.session.get.done" });
    return Response.json({ session });
  } catch (err) {
    const code = err instanceof PathwaysError ? err.code : "INTERNAL_ERROR";
    const status = err instanceof PathwaysError ? err.statusCode : 500;
    if (err instanceof NotFoundError) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Session not found or expired." } }, { status: 404 });
    }
    log.error({ action: "api.guest.session.get.error", error: String(err) });
    return Response.json({ error: { code, message: safeErrorMessage(err) } }, { status });
  }
}
