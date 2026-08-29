import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { createVoiceSession, findExistingSession } from "@/modules/voice/service";
import { PathwaysError, AuthError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.voice.session.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.voice.session.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Create a new voice session (or resume an existing in-progress one) and return its ID. */
export async function POST(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.session.start" });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) {
      throw new AuthError("Profile not found");
    }

    // Resume an existing in-progress session rather than creating a duplicate
    const existing = await findExistingSession(profile.id, log);
    if (existing) {
      log.info({ action: "api.voice.session.resumed", sessionId: existing.sessionId });
      return Response.json({
        sessionId: existing.sessionId,
        resumed: true,
        history: existing.history,
        partialProfile: existing.partialProfile,
      });
    }

    const sessionId = await createVoiceSession(profile.id, log);

    log.info({ action: "api.voice.session.done", sessionId });
    return Response.json({ sessionId, resumed: false, history: [], partialProfile: {} });
  } catch (error) {
    return handleError(error, log);
  }
}
