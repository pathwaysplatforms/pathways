import { z } from "zod";
import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth } from "@/modules/auth/service";
import { PathwaysError, ValidationError, InternalError } from "@/lib/errors";
import type { Logger } from "pino";

const DEEPGRAM_PROJECT_ID = "9db47372-dbcc-4ff6-a1fb-e3f2ebfe34ab";
const DEEPGRAM_KEY_URL = `https://api.deepgram.com/v1/projects/${DEEPGRAM_PROJECT_ID}/keys`;

const DeepgramKeySchema = z.object({
  key: z.string(),
  api_key_id: z.string(),
});

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.voice.deepgram-token.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.voice.deepgram-token.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/**
 * Create a short-lived Deepgram child key server-side and return it to the
 * authenticated client. The master key is never exposed to the browser.
 */
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

    log.info({ action: "api.voice.deepgram-token.deepgram_request" });

    const dgRes = await fetch(DEEPGRAM_KEY_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "pathways-session",
        time_to_live_in_seconds: 30,
      }),
    });

    if (!dgRes.ok) {
      throw new InternalError("Deepgram child key creation failed", { status: dgRes.status });
    }

    const raw: unknown = await dgRes.json();
    const parsed = DeepgramKeySchema.safeParse(raw);
    if (!parsed.success) {
      throw new InternalError("Deepgram response did not match expected schema");
    }

    log.info({ action: "api.voice.deepgram-token.done" });
    return Response.json({ token: parsed.data.key });
  } catch (error) {
    return handleError(error, log);
  }
}
