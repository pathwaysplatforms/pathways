import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth, getProfile } from "@/modules/auth/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PathwaysError, AuthError, DatabaseError } from "@/lib/errors";
import type { Logger } from "pino";

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: "api.onboarding.reset.error", code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode }
    );
  }
  log.error({ action: "api.onboarding.reset.error", error: String(error) });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 }
  );
}

/**
 * Reset onboarding: mark in-progress voice sessions abandoned, clear all voice
 * profile fields, and return onboarding_status to 'not_started'.
 * POST /api/onboarding/reset
 */
export async function POST(_req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "api.onboarding.reset.start" });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) {
      throw new AuthError("Profile not found");
    }

    const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;

    // Soft-delete in-progress voice sessions
    await adminDb
      .from("voice_sessions")
      .update({ status: "abandoned" })
      .eq("profile_id", profile.id)
      .eq("status", "in_progress");

    // Clear all voice-collected fields and reset onboarding state
    const { error } = await adminDb
      .from("profiles")
      .update({
        onboarding_status: "not_started",
        onboarding_step: "not_started",
        onboarding_method: null,
        pathway_input_json: null,
        voice_session_data: null,
        full_name: null,
        date_of_birth: null,
        nationality: null,
        current_country: null,
        marital_status: null,
        spouse_coming_to_canada: null,
        education_level_voice: null,
        years_experience: null,
        has_canadian_experience: null,
        occupation: null,
        language_proficiency_self: null,
        has_family_in_canada: null,
        intended_province: null,
        annual_income: null,
        income_currency: null,
      })
      .eq("id", profile.id);

    if (error) {
      throw new DatabaseError("Failed to reset onboarding profile", { profileId: profile.id }, error);
    }

    log.info({ action: "api.onboarding.reset.done", profileId: profile.id });
    return Response.json({ success: true });
  } catch (error) {
    return handleError(error, log);
  }
}
