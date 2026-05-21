import { type NextRequest } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { streamConversationTurn } from "@/modules/voice/service";
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

/** Process one voice conversation turn, streaming audio chunks via SSE. */
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
    const sessionStartMs = Number(req.headers.get("x-session-start") ?? Date.now());

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const gen = streamConversationTurn(
            sessionId,
            profile.id,
            transcript,
            history,
            sessionStartMs,
            log
          );

          for await (const event of gen) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }

          controller.close();
        } catch (err) {
          const errorEvent = {
            type: "error",
            code: err instanceof PathwaysError ? err.code : "INTERNAL_ERROR",
            message: err instanceof Error ? err.message : "An error occurred",
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleError(error, log);
  }
}
