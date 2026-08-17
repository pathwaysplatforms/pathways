import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/modules/auth/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GuestFormOnboarding } from "@/components/onboarding/GuestFormOnboarding";

/** Form onboarding entry point — auth'd users submit to the auth profile APIs; guests use a guest session. */
export default async function FormOnboardingPage() {
  const profile = await getProfile();

  if (profile) {
    if (profile.onboarding_step === "voice_complete") redirect("/onboarding/review");
    if (profile.onboarding_step === "complete") redirect("/dashboard");

    // Re-select the full column set (not just the narrower `Profile` type) so any
    // previously-saved answers — from an earlier partial form session, a switch
    // from voice, etc. — can hydrate the form and resume mid-flow instead of
    // restarting from question one.
    const db = (await createSupabaseServerClient()) as unknown as SupabaseClient;
    const { data } = await db.from("profiles").select("*").eq("id", profile.id).single();

    return <GuestFormOnboarding mode="auth" initialData={(data ?? {}) as Record<string, unknown>} />;
  }

  return <GuestFormOnboarding />;
}
