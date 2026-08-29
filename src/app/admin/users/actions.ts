"use server";

import { revalidatePath } from "next/cache";
import { createRequestLogger } from "@/lib/logger";
import { requireAdmin } from "@/modules/auth/service";
import {
  updateUserSubscription,
  toggleAdminRole,
  adminDeleteUser,
} from "@/modules/account/adminService";
import { PathwaysError } from "@/lib/errors";

type ActionResult = { error?: { code: string; message: string } };

/** Updates the subscription status of any user. Requires admin. */
export async function updateSubscriptionAction(
  targetUserId: string,
  status: string
): Promise<ActionResult> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "admin.updateSubscription.action.start", targetUserId });

  try {
    const admin = await requireAdmin();
    await updateUserSubscription(targetUserId, status, admin.id, log);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    log.error({ action: "admin.updateSubscription.action.error", err });
    if (err instanceof PathwaysError) {
      return { error: { code: err.code, message: err.message } };
    }
    return { error: { code: "INTERNAL_ERROR", message: "Failed to update subscription." } };
  }
}

/** Grants or revokes admin role for a user. Requires admin. */
export async function toggleAdminAction(
  targetUserId: string,
  grant: boolean
): Promise<ActionResult> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "admin.toggleAdmin.action.start", targetUserId, grant });

  try {
    const admin = await requireAdmin();
    await toggleAdminRole(targetUserId, grant, admin.id, log);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    log.error({ action: "admin.toggleAdmin.action.error", err });
    if (err instanceof PathwaysError) {
      return { error: { code: err.code, message: err.message } };
    }
    return { error: { code: "INTERNAL_ERROR", message: "Failed to update admin role." } };
  }
}

/** Permanently deletes a user. Requires admin. */
export async function deleteUserAction(
  targetUserId: string
): Promise<ActionResult> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "admin.deleteUser.action.start", targetUserId });

  try {
    const admin = await requireAdmin();
    await adminDeleteUser(targetUserId, admin.id, log);
    revalidatePath("/admin/users");
    return {};
  } catch (err) {
    log.error({ action: "admin.deleteUser.action.error", err });
    if (err instanceof PathwaysError) {
      return { error: { code: err.code, message: err.message } };
    }
    return { error: { code: "INTERNAL_ERROR", message: "Failed to delete user." } };
  }
}
