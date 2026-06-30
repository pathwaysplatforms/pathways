"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRequestLogger } from "@/lib/logger";
import { requireAuth } from "@/modules/auth/service";
import { updateAccountProfile, deleteAccount } from "@/modules/account/service";
import { PathwaysError, ValidationError } from "@/lib/errors";
import type { UpdateProfileInput } from "@/modules/account/types";

type ActionResult = { error?: { code: string; message: string } };

/** Updates the current user's display name, language, phone, and residence. */
export async function updateProfileAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "account.updateProfileAction.start" });

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { error: { code: "AUTH_ERROR", message: "You must be signed in." } };
  }

  const input: UpdateProfileInput = {
    full_name: (formData.get("full_name") as string | null) || null,
    preferred_language: (formData.get("preferred_language") as string | null) || undefined,
    phone: (formData.get("phone") as string | null) || null,
    nationality: (formData.get("nationality") as string | null) || null,
    country_of_residence: (formData.get("country_of_residence") as string | null) || null,
  };

  try {
    await updateAccountProfile(user.id, input, log);
    revalidatePath("/account");
    log.info({ action: "account.updateProfileAction.done", userId: user.id });
    return {};
  } catch (err) {
    log.error({ action: "account.updateProfileAction.error", err });
    if (err instanceof PathwaysError) {
      return { error: { code: err.code, message: err.message } };
    }
    return { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } };
  }
}

/** Permanently deletes the current user's account and all associated data. */
export async function deleteAccountAction(): Promise<never> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: "account.deleteAccountAction.start" });

  const user = await requireAuth();

  try {
    await deleteAccount(user.id, log);
    log.info({ action: "account.deleteAccountAction.done", userId: user.id });
  } catch (err) {
    log.error({ action: "account.deleteAccountAction.error", err });
    if (err instanceof ValidationError) throw err;
    throw new Error("Failed to delete account. Please contact support.");
  }

  redirect("/");
}
