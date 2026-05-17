import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { processConversationTurn } from "@/modules/voice/service";
import { TurnRequestSchema } from "@/modules/voice/types";
import { PathwaysError, AuthError, ValidationError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.voice.turn.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.voice.turn.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Process one voice conversation turn and return the agent message + audio. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.turn.start" });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) {
      throw new AuthError("Profile not found");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    const parsed = TurnRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid request body", {
        errors: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      });
    }

    const { sessionId, transcript, history } = parsed.data;

    // Session start time is approximated from the current request
    // The client sends session start timestamp via a custom header if needed,
    // but for duration we track from a best-effort server timestamp.
    const sessionStartMs = Number(req.headers.get("x-session-start") ?? Date.now());

    const result = await processConversationTurn(
      sessionId,
      profile.id,
      transcript,
      history,
      sessionStartMs,
      log
    );

    log.info({ action: "api.voice.turn.done", sessionId, complete: result.complete });
    return Response.json(result);
  } catch (error) {
    return handleError(error, log);
  }
}
