"use server";

import { signInWithEmail, signInWithGoogle } from "@/modules/auth/service";
import { ValidationError } from "@/lib/errors";
import { createRequestLogger } from "@/lib/logger";

type EmailActionResult =
  | { success: true; email: string }
  | { success: false; error: string };

export async function signInWithEmailAction(
  email: string
): Promise<EmailActionResult> {
  try {
    await signInWithEmail(email);
    return { success: true, email };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: "Please enter a valid email address." };
    }
    const reqLogger = createRequestLogger(crypto.randomUUID());
    const cause = error instanceof Error ? (error.cause ?? error) : error;
    reqLogger.error({ action: "auth.magic_link_action_failed", error: String(cause) });
    return {
      success: false,
      error: "We could not send a sign-in link. Please try again.",
    };
  }
}

export async function signInWithGoogleAction(_formData: FormData): Promise<void> {
  await signInWithGoogle();
}
