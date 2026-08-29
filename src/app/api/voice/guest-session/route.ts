import type { NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { createGuestSession } from "@/modules/guest/service";
import { PathwaysError } from "@/lib/errors";

/**
 * Create a guest session and return its token as the voice session ID.
 * The token doubles as the session identifier for subsequent turn requests.
 */
export async function POST(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.guest-session.start" });

  try {
    const session = await createGuestSession(log);
    log.info({ action: "api.voice.guest-session.done" });
    return Response.json({
      sessionId: session.session_token,
      resumed: false,
      history: [],
      partialProfile: {},
    });
  } catch (err) {
    const code = err instanceof PathwaysError ? err.code : "INTERNAL_ERROR";
    const status = err instanceof PathwaysError ? err.statusCode : 500;
    log.error({ action: "api.voice.guest-session.error", error: String(err) });
    return Response.json({ error: { code, message: String(err) } }, { status });
  }
}
