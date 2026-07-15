import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { maskToken } from "@/lib/logger";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/errors";
import type { GuestSession, GuestOnboardingData } from "./types";
import type { PathwayMatchResult } from "@/types/pathways";
import { VoiceExtractedProfileSchema } from "@/modules/voice/types";

/** Allowlist of profile columns that guest onboarding data may write to. */
const PROFILE_FIELD_ALLOWLIST = new Set(
  Object.keys(VoiceExtractedProfileSchema.omit({ requires_review: true }).shape)
);

/** Create a new guest session row and return it. */
export async function createGuestSession(log: Logger): Promise<GuestSession> {
  log.info({ action: "guest.session.create" });
  const db = createSupabaseAdminClient() as unknown as SupabaseClient;

  const { data, error } = await db
    .from("guest_sessions")
    .insert({ onboarding_data: {} })
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create guest session", {}, error ?? undefined);
  }

  log.info({
    action: "guest.session.created",
    tokenPrefix: maskToken((data as GuestSession).session_token),
  });
  return data as GuestSession;
}

/** Fetch a guest session by its public token. Throws NotFoundError if missing or expired. */
export async function getGuestSession(token: string, log: Logger): Promise<GuestSession> {
  log.info({ action: "guest.session.get", tokenPrefix: maskToken(token) });

  if (!token || token.length < 10) {
    throw new ValidationError("Invalid session token");
  }

  const db = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db
    .from("guest_sessions")
    .select("*")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    throw new NotFoundError("Guest session not found or expired");
  }

  return data as GuestSession;
}

/** Merge new onboarding data into an existing guest session. */
export async function updateGuestOnboardingData(
  token: string,
  delta: GuestOnboardingData,
  log: Logger
): Promise<GuestSession> {
  log.info({ action: "guest.session.update_data", tokenPrefix: maskToken(token) });

  const existing = await getGuestSession(token, log);
  const merged = { ...existing.onboarding_data, ...delta };

  const db = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db
    .from("guest_sessions")
    .update({ onboarding_data: merged })
    .eq("session_token", token)
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to update guest session data", { tokenPrefix: maskToken(token) }, error ?? undefined);
  }

  log.info({ action: "guest.session.data_updated", tokenPrefix: maskToken(token) });
  return data as GuestSession;
}

/** Save pathway match results to a guest session. */
export async function saveGuestPathwayResults(
  token: string,
  results: PathwayMatchResult,
  log: Logger
): Promise<GuestSession> {
  log.info({ action: "guest.session.save_results", tokenPrefix: maskToken(token) });

  const db = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await db
    .from("guest_sessions")
    .update({ pathway_results: results as unknown as Record<string, unknown> })
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to save guest pathway results", { tokenPrefix: maskToken(token) }, error ?? undefined);
  }

  log.info({ action: "guest.session.results_saved", tokenPrefix: maskToken(token) });
  return data as GuestSession;
}

/** Copy guest session data into the authenticated user's profile after signup. */
export async function migrateGuestSession(
  token: string,
  authUserId: string,
  log: Logger
): Promise<void> {
  log.info({ action: "guest.session.migrate", tokenPrefix: maskToken(token), authUserId });

  const session = await getGuestSession(token, log);
  const db = createSupabaseAdminClient() as unknown as SupabaseClient;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  if (profileError || !profile) {
    throw new DatabaseError("Profile not found for migration", { authUserId }, profileError ?? undefined);
  }

  const profileId = (profile as { id: string }).id;
  const raw = session.onboarding_data as Record<string, unknown>;

  // Only write fields on the explicit allowlist — prevents a poisoned guest session
  // from writing arbitrary columns such as is_admin or subscription_status.
  const safeFields = Object.fromEntries(
    Object.entries(raw).filter(([k]) => PROFILE_FIELD_ALLOWLIST.has(k))
  );

  if (Object.keys(safeFields).length > 0) {
    const { error: updateError } = await db
      .from("profiles")
      .update(safeFields)
      .eq("id", profileId);

    if (updateError) {
      throw new DatabaseError("Failed to migrate guest data to profile", { profileId }, updateError);
    }
  }

  // Expire the session after migration
  await db
    .from("guest_sessions")
    .update({ expires_at: new Date().toISOString() })
    .eq("session_token", token);

  log.info({ action: "guest.session.migrated", tokenPrefix: maskToken(token), profileId });
}
