import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { GuestVoiceOnboarding } from "@/components/onboarding/GuestVoiceOnboarding";

/** Voice/chat/form onboarding interface — no sidebar, no nav. */
export default async function VoicePage() {
  const profile = await getProfile();

  if (profile) {
    if (profile.onboarding_step === "voice_complete") redirect("/onboarding/review");
    if (profile.onboarding_step === "complete") redirect("/dashboard");
    return <OnboardingLayout />;
  }

  // Guest (unauthenticated) — full voice UI with guest session backing
  return <GuestVoiceOnboarding />;
}
