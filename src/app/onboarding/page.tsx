import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { GuestOnboardingIntro } from "@/components/onboarding/GuestOnboardingIntro";

/**
 * Onboarding entry point.
 * - Authenticated users with complete onboarding → /dashboard (middleware also handles this)
 * - Authenticated users mid-onboarding → correct step (voice/review)
 * - Unauthenticated guests → welcome intro with voice/form choice
 */
export default async function OnboardingPage() {
  const profile = await getProfile();

  if (profile) {
    if (profile.onboarding_step === "voice_complete") redirect("/onboarding/review");
    if (profile.onboarding_step === "complete") redirect("/dashboard");
    // not_started / voice_in_progress — fall through to the choice screen below
    // so the CTA always lands here first, and the user picks voice or form.
  }

  return <GuestOnboardingIntro />;
}
