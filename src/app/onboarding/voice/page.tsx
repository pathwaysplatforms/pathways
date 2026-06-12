import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";

/** Voice/chat/form onboarding interface — no sidebar, no nav. */
export default async function VoicePage() {
  const profile = await getProfile();
  if (profile?.onboarding_step === "voice_complete") {
    redirect("/onboarding/review");
  }
  if (profile?.onboarding_step === "complete") {
    redirect("/dashboard");
  }

  return <OnboardingLayout />;
}
