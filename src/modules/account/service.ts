"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Logger } from "pino";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AccountProfile, UpdateProfileInput } from "./types";

const PROFILE_SELECT =
  "id, auth_user_id, full_name, email, avatar_url, preferred_language, phone, nationality, country_of_residence, subscription_status, is_admin, created_at, updated_at";

const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(200).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  preferred_language: z.string().length(2).optional(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format (e.g. +16135551234)")
    .optional()
    .nullable(),
  nationality: z.string().max(100).optional().nullable(),
  country_of_residence: z.string().max(100).optional().nullable(),
});

/** Fetches the full account profile for a user by auth_user_id. */
export async function getAccountProfile(
  authUserId: string,
  log: Logger
): Promise<AccountProfile> {
  log.info({ action: "account.getProfile.start", authUserId });
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("auth_user_id", authUserId)
    .single();

  if (error || !data) {
    log.error({ action: "account.getProfile.error", authUserId, error });
    throw new NotFoundError("Profile not found", { authUserId });
  }

  log.info({ action: "account.getProfile.done", authUserId });
  return data as AccountProfile;
}

/** Updates mutable account profile fields and returns the updated profile. */
export async function updateAccountProfile(
  authUserId: string,
  input: UpdateProfileInput,
  log: Logger
): Promise<AccountProfile> {
  log.info({ action: "account.updateProfile.start", authUserId });
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Invalid profile data", {
      errors: parsed.error.flatten(),
    });
  }

  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from("profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("auth_user_id", authUserId)
    .select(PROFILE_SELECT)
    .single();

  if (error || !data) {
    log.error({ action: "account.updateProfile.error", authUserId, error });
    throw new DatabaseError("Failed to update profile", { authUserId });
  }

  log.info({ action: "account.updateProfile.done", authUserId });
  return data as AccountProfile;
}

/** Upgrades the user's subscription_status to 'paid'. */
export async function upgradeSubscription(
  authUserId: string,
  log: Logger
): Promise<void> {
  log.info({ action: "account.upgradeSubscription.start", authUserId });
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("profiles")
    .update({ subscription_status: "paid", updated_at: new Date().toISOString() })
    .eq("auth_user_id", authUserId);

  if (error) {
    log.error({ action: "account.upgradeSubscription.error", authUserId, error });
    throw new DatabaseError("Failed to upgrade subscription", { authUserId });
  }

  log.info({ action: "account.upgradeSubscription.done", authUserId });
}

/**
 * Permanently deletes a user's profile and their Supabase Auth record.
 * This is irreversible — call only from a confirmed server action.
 */
export async function deleteAccount(authUserId: string, log: Logger): Promise<void> {
  log.info({ action: "account.deleteAccount.start", authUserId });
  const adminClient = createSupabaseAdminClient();
  const admin = adminClient as unknown as SupabaseClient;

  // Delete the profile row first (FK cascade removes related data)
  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("auth_user_id", authUserId);

  if (profileError) {
    log.error({ action: "account.deleteAccount.profileError", authUserId, profileError });
    throw new DatabaseError("Failed to delete profile", { authUserId });
  }

  // Remove the Supabase Auth user via the admin API
  const { error: authError } = await adminClient.auth.admin.deleteUser(authUserId);

  if (authError) {
    log.error({ action: "account.deleteAccount.authError", authUserId, authError });
    throw new DatabaseError("Failed to delete auth user", { authUserId });
  }

  log.info({ action: "account.deleteAccount.done", authUserId });
}
