import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";

/** Onboarding entry point — routes to the correct step based on status. */
export default async function OnboardingPage() {
  const profile = await getProfile();
  if (profile?.onboarding_step === "voice_complete") {
    redirect("/onboarding/review");
  }
  if (profile?.onboarding_step === "complete") {
    redirect("/dashboard");
  }
  redirect("/onboarding/voice");
}
