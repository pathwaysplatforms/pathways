"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Logger } from "pino";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DatabaseError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AdminUserRow, AdminUsersResult, SubscriptionStatus } from "./types";

const PAGE_SIZE = 20;

const subscriptionSchema = z.enum(["guest", "free", "paid"]);

const ADMIN_USER_SELECT =
  "id, auth_user_id, full_name, email, subscription_status, is_admin, created_at, onboarding_step";

/** Returns a paginated, optionally-filtered list of all user profiles. */
export async function listUsers(
  page: number,
  search: string,
  log: Logger
): Promise<AdminUsersResult> {
  log.info({ action: "admin.listUsers.start", page, search });
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;

  let query = admin.from("profiles").select(ADMIN_USER_SELECT, { count: "exact" });

  if (search.trim()) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    log.error({ action: "admin.listUsers.error", error });
    throw new DatabaseError("Failed to list users", { page, search });
  }

  log.info({ action: "admin.listUsers.done", total: count });
  return {
    users: (data ?? []) as AdminUserRow[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** Updates a user's subscription_status. Admin-only. */
export async function updateUserSubscription(
  targetUserId: string,
  status: string,
  adminId: string,
  log: Logger
): Promise<void> {
  log.info({ action: "admin.updateSubscription.start", targetUserId, status, adminId });

  const parsed = subscriptionSchema.safeParse(status);
  if (!parsed.success) {
    throw new ValidationError("Invalid subscription status", { status });
  }

  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_status: parsed.data as SubscriptionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", targetUserId);

  if (error) {
    log.error({ action: "admin.updateSubscription.error", targetUserId, error });
    throw new DatabaseError("Failed to update subscription", { targetUserId });
  }

  log.info({ action: "admin.updateSubscription.done", targetUserId, adminId });
}

/** Grants or revokes admin role for a user. Admin-only. */
export async function toggleAdminRole(
  targetUserId: string,
  grant: boolean,
  adminId: string,
  log: Logger
): Promise<void> {
  log.info({ action: "admin.toggleAdmin.start", targetUserId, grant, adminId });

  if (targetUserId === adminId) {
    throw new ValidationError("Admins may not modify their own admin status");
  }

  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from("profiles")
    .update({ is_admin: grant, updated_at: new Date().toISOString() })
    .eq("auth_user_id", targetUserId);

  if (error) {
    log.error({ action: "admin.toggleAdmin.error", targetUserId, error });
    throw new DatabaseError("Failed to update admin role", { targetUserId });
  }

  log.info({ action: "admin.toggleAdmin.done", targetUserId, grant, adminId });
}

/** Permanently deletes a user's profile and auth record. Admin-only. */
export async function adminDeleteUser(
  targetUserId: string,
  adminId: string,
  log: Logger
): Promise<void> {
  log.info({ action: "admin.deleteUser.start", targetUserId, adminId });

  if (targetUserId === adminId) {
    throw new ValidationError("Admins may not delete their own account from the admin panel");
  }

  // Verify the user exists before deletion
  const adminClient = createSupabaseAdminClient();
  const admin = adminClient as unknown as SupabaseClient;
  const { data: profile, error: fetchError } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", targetUserId)
    .single();

  if (fetchError || !profile) {
    throw new NotFoundError("User not found", { targetUserId });
  }

  const { error: deleteError } = await admin
    .from("profiles")
    .delete()
    .eq("auth_user_id", targetUserId);

  if (deleteError) {
    log.error({ action: "admin.deleteUser.profileError", targetUserId, deleteError });
    throw new DatabaseError("Failed to delete profile", { targetUserId });
  }

  const { error: authError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (authError) {
    log.error({ action: "admin.deleteUser.authError", targetUserId, authError });
    throw new DatabaseError("Failed to delete auth user", { targetUserId });
  }

  log.info({ action: "admin.deleteUser.done", targetUserId, adminId });
}
