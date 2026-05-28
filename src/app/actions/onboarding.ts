"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRequestLogger } from "@/lib/logger";
import { redirect } from "next/navigation";

/** Reset the current user's onboarding step to 'not_started' and redirect to voice onboarding. */
export async function resetOnboarding(): Promise<never> {
  const supabase = createSupabaseServerClient() as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const logger = createRequestLogger(`reset-onboarding-${user.id}`);
  logger.info({ action: "onboarding.reset.start", userId: user.id });

  await supabase
    .from("profiles")
    .update({ onboarding_step: "not_started" })
    .eq("auth_user_id", user.id);

  logger.info({ action: "onboarding.reset.complete", userId: user.id });

  redirect("/onboarding/voice");
}
