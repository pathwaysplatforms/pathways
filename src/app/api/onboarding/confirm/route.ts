import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPathwayInput } from "@/lib/pathway-input";
import type { ScoredPathway } from "@/modules/voice/matcher-engine";
import { computeProfileCompletenessPct } from "@/lib/completeness";
import { PathwaysError, AuthError, ValidationError, DatabaseError } from "@/lib/errors";
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

    const rawSessionData = (profile.voice_session_data ?? {}) as Record<string, unknown>;
    const extracted = rawSessionData as Partial<VoiceExtractedProfile>;

    // Preserve Akinator preselect written by finalizeVoiceSession (if matcher converged during voice)
    const matcherScored = rawSessionData._matcher_scored as ScoredPathway[] | undefined;
    const matcherTurnCount = rawSessionData._matcher_turn_count as number | undefined;
    const matcherResult =
      matcherScored && matcherScored.length > 0 && matcherTurnCount != null
        ? { scores: matcherScored, convergedAtTurn: matcherTurnCount }
        : null;

    const pathwayInput = buildPathwayInput(profile.id, extracted, voiceSessionId, method, matcherResult);
    const profileCompletenessPct = computeProfileCompletenessPct(extracted);

    const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;
    const { error } = await adminDb
      .from("profiles")
      .update({
        pathway_input_json: pathwayInput as unknown as Record<string, unknown>,
        onboarding_status: "complete",
        onboarding_step: "complete",
        profile_completeness_pct: profileCompletenessPct,
      })
      .eq("id", profile.id);

    if (error) {
      throw new DatabaseError(`Failed to save pathway input: ${error.message}`, { profileId: profile.id });
    }

    log.info({ action: "api.onboarding.confirm.done", profileId: profile.id });
    return Response.json({ success: true });
  } catch (error) {
    return handleError(error, log);
  }
}
