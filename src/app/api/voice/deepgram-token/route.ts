import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth } from "@/modules/auth/service";
import { PathwaysError, ValidationError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({
      action: "api.voice.deepgram-token.error",
      code: error.code,
      message: error.message,
    });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({
    action: "api.voice.deepgram-token.error",
    error: String(error),
  });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Return the Deepgram API key for client-side live transcription.
 *  Safe to return directly — route is protected by requireAuth(). */
export async function GET(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.deepgram-token.start" });

  try {
    await requireAuth();

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new ValidationError("DEEPGRAM_API_KEY is not configured");
    }

    log.info({ action: "api.voice.deepgram-token.done" });
    return Response.json({ token: apiKey });
  } catch (error) {
    return handleError(error, log);
  }
}
