// Pre-recorded transcription fallback — retained for mobile/Safari
// fallback if live WebSocket approach needs platform-specific handling.
// Currently unused in the primary flow.
import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth } from "@/modules/auth/service";
import { PathwaysError, ValidationError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({
      action: "api.voice.transcribe.error",
      code: error.code,
      message: error.message,
    });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.voice.transcribe.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Transcription failed." } },
    { status: 500 }
  );
}

/** Transcribe an audio blob using Deepgram's pre-recorded API. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.transcribe.start" });

  try {
    await requireAuth();

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new ValidationError("DEEPGRAM_API_KEY is not configured");
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      throw new ValidationError("Request must include an audio blob");
    }

    if (audioFile.size === 0) {
      throw new ValidationError("Audio blob is empty");
    }

    log.info({
      action: "api.voice.transcribe.calling_deepgram",
      audioBytes: audioFile.size,
      mimeType: audioFile.type,
    });

    const deepgramUrl =
      "https://api.deepgram.com/v1/listen" +
      "?model=nova-3" +
      "&smart_format=true" +
      "&language=en";

    const arrayBuffer = await audioFile.arrayBuffer();

    const deepgramRes = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audioFile.type || "audio/webm",
      },
      body: arrayBuffer,
    });

    if (!deepgramRes.ok) {
      const errorText = await deepgramRes.text();
      log.error({
        action: "api.voice.transcribe.deepgram_error",
        status: deepgramRes.status,
        body: errorText,
      });
      throw new ValidationError(
        `Deepgram transcription failed: ${deepgramRes.status}`
      );
    }

    const result = (await deepgramRes.json()) as {
      results?: {
        channels?: {
          alternatives?: { transcript?: string }[];
        }[];
      };
    };

    const transcript =
      result.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    log.info({
      action: "api.voice.transcribe.done",
      transcriptLength: transcript.length,
    });

    return Response.json({ transcript });
  } catch (error) {
    return handleError(error, log);
  }
}
