import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { streamConversationTurnGuest } from "@/modules/voice/service";
import { TurnRequestSchema } from "@/modules/voice/types";
import { PathwaysError, ValidationError } from "@/lib/errors";
import type { PartialExtractedProfile } from "@/modules/voice/types";

const GuestTurnSchema = TurnRequestSchema.extend({
  currentPartial: z.record(z.unknown()).optional(),
});

/** Process one voice conversation turn for a guest user — no database writes. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.guest-turn.start" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body." } }, { status: 400 });
  }

  const parsed = GuestTurnSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid request body");
  }

  const { transcript, history, currentPartial } = parsed.data;
  const partial = (currentPartial ?? {}) as PartialExtractedProfile;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const gen = streamConversationTurnGuest(partial, transcript, history, log);
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

  log.info({ action: "api.voice.guest-turn.streaming" });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
