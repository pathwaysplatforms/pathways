import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPathwayInput } from "@/lib/pathway-input";
import { PathwaysError, AuthError, ValidationError } from "@/lib/errors";
import type { Logger } from "pino";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

const ConfirmBodySchema = z.object({
  voiceSessionId: z.string().uuid().nullable().optional(),
  method: z.enum(["voice", "chat", "form"]).optional(),
});

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.onboarding.confirm.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.onboarding.confirm.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/**
 * Confirm the onboarding profile: build PathwayInput JSON and mark onboarding complete.
 * POST /api/onboarding/confirm
 */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.onboarding.confirm.start" });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) {
      throw new AuthError("Profile not found");
    }

    let body: z.infer<typeof ConfirmBodySchema> = {};
    try {
      const raw = await req.json() as unknown;
      body = ConfirmBodySchema.parse(raw);
    } catch {
      throw new ValidationError("Invalid request body");
    }

    const voiceSessionId = body.voiceSessionId ?? null;
    const method = body.method ?? "voice";

    const extracted = (profile.voice_session_data ?? {}) as Partial<VoiceExtractedProfile>;
    const pathwayInput = buildPathwayInput(profile.id, extracted, voiceSessionId, method);

    const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;
    const { error } = await adminDb
      .from("profiles")
      .update({
        pathway_input_json: pathwayInput as unknown as Record<string, unknown>,
        onboarding_status: "complete",
        onboarding_step: "complete",
      })
      .eq("id", profile.id);

    if (error) {
      throw new Error(`Failed to save pathway input: ${error.message}`);
    }

    log.info({ action: "api.onboarding.confirm.done", profileId: profile.id });
    return Response.json({ success: true });
  } catch (error) {
    return handleError(error, log);
  }
}
