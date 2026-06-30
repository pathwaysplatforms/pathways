import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { GuestFormOnboarding } from "@/components/onboarding/GuestFormOnboarding";

/** Form onboarding entry point — auth'd users submit to the auth profile APIs; guests use a guest session. */
export default async function FormOnboardingPage() {
  const profile = await getProfile();

  if (profile) {
    if (profile.onboarding_step === "voice_complete") redirect("/onboarding/review");
    if (profile.onboarding_step === "complete") redirect("/dashboard");
    return <GuestFormOnboarding mode="auth" />;
  }

  return <GuestFormOnboarding />;
}
