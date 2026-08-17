import { type NextRequest } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VoiceExtractedProfileSchema } from "@/modules/voice/types";
import { PathwaysError, AuthError, ValidationError, DatabaseError } from "@/lib/errors";
import type { Logger } from "pino";

const ProfileUpdateSchema = VoiceExtractedProfileSchema.omit({ requires_review: true }).partial();

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.onboarding.profile.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.onboarding.profile.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/**
 * Persist partial profile field updates (used by the form onboarding flow, review-screen
 * inline editing, and the profile tracker panel).
 * POST /api/onboarding/profile
 */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.onboarding.profile.start" });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) {
      throw new AuthError("Profile not found");
    }

    let updates: z.infer<typeof ProfileUpdateSchema>;
    try {
      const raw = await req.json() as unknown;
      updates = ProfileUpdateSchema.parse(raw);
    } catch {
      throw new ValidationError("Invalid profile update body");
    }

    // destination_country is in the voice schema but not a DB column — keep it in
    // voice_session_data only so PostgREST doesn't reject the update.
    const { destination_country: _dc, ...dbSafeUpdates } = updates as typeof updates & { destination_country?: unknown };

    const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;
    const { error } = await adminDb
      .from("profiles")
      .update({
        ...dbSafeUpdates,
        onboarding_step: "voice_in_progress",
        voice_session_data: {
          ...(profile.voice_session_data ?? {}),
          ...updates,
        },
      })
      .eq("id", profile.id);

    if (error) {
      throw new DatabaseError(`Failed to update profile: ${error.message}`, { profileId: profile.id });
    }

    log.info({ action: "api.onboarding.profile.done", profileId: profile.id });
    return Response.json({ success: true });
  } catch (error) {
    return handleError(error, log);
  }
}
