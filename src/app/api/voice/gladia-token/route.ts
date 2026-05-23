import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth } from "@/modules/auth/service";
import { PathwaysError, ValidationError } from "@/lib/errors";
import type { Logger } from "pino";

// The Gladia auth flow is two-step: we POST to Gladia's REST API with our
// secret key in a server-side header, and Gladia returns a single-use
// WebSocket URL with a short-lived session token embedded in the query string.
// The browser connects to that URL directly — GLADIA_API_KEY never leaves
// the server, which is strictly safer than Deepgram's query-param approach.

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({
      action: "api.voice.gladia-token.error",
      code: error.code,
      message: error.message,
    });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({
    action: "api.voice.gladia-token.error",
    error: String(error),
  });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/** Create a Gladia live-transcription session and return the WebSocket URL. */
export async function GET(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.gladia-token.start" });

  try {
    await requireAuth();

    const apiKey = process.env.GLADIA_API_KEY;
    if (!apiKey) {
      throw new ValidationError("GLADIA_API_KEY is not configured");
    }

    const gladiaRes = await fetch("https://api.gladia.io/v2/live", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gladia-key": apiKey,
      },
      body: JSON.stringify({
        encoding: "wav/pcm",
        sample_rate: 16000,
        bit_depth: 16,
        channels: 1,
        model: "solaria-1",
        // 1.0 second of silence triggers utterance end — equivalent to
        // Deepgram's utterance_end_ms=1000.
        endpointing: 1.0,
        language_config: {
          languages: ["en"],
        },
        messages_config: {
          receive_partial_transcripts: false,
          receive_final_transcripts: true,
          // speech_start / speech_end events drive turn triggering.
          receive_speech_events: true,
        },
      }),
    });

    if (!gladiaRes.ok) {
      const body = await gladiaRes.text();
      log.error({
        action: "api.voice.gladia-token.gladia_error",
        status: gladiaRes.status,
        body,
      });
      throw new ValidationError(`Gladia session creation failed: ${gladiaRes.status}`);
    }

    const session = (await gladiaRes.json()) as { id: string; url: string };

    log.info({ action: "api.voice.gladia-token.done", sessionId: session.id });
    return Response.json({ url: session.url });
  } catch (error) {
    return handleError(error, log);
  }
}
