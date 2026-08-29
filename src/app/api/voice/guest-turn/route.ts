import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { streamConversationTurnGuest } from "@/modules/voice/service";
import { TurnRequestSchema } from "@/modules/voice/types";
import { PathwaysError, ValidationError } from "@/lib/errors";
import type { PartialExtractedProfile } from "@/modules/voice/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

const GuestTurnSchema = TurnRequestSchema.extend({
  currentPartial: z.record(z.unknown()).optional(),
});

/** Process one voice conversation turn for a guest user — no database writes. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.voice.guest-turn.start" });

  // Each turn calls Claude + ElevenLabs TTS; rate limit per IP to bound abuse cost.
  const rl = await enforceRateLimit(`guest-turn:${getClientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    log.warn({ action: "api.voice.guest-turn.rate_limited" });
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body." } }, { status: 400 });
  }

  const parsed = GuestTurnSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request body." } }, { status: 422 });
  }

  const { sessionId, transcript, history, currentPartial } = parsed.data;

  // Verify the session exists and has not expired before invoking any AI calls.
  const db = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data: sessionRow } = await db
    .from("guest_sessions")
    .select("id")
    .eq("session_token", sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!sessionRow) {
    log.warn({ action: "api.voice.guest-turn.invalid_session", sessionId });
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired session." } }, { status: 401 });
  }

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
