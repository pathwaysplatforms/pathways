import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";

/** Onboarding entry point — routes to the correct step based on status. */
export default async function OnboardingPage() {
  const profile = await getProfile();
  if (
    profile?.onboarding_status === "voice_complete" ||
    profile?.onboarding_status === "complete"
  ) {
    redirect("/onboarding/review");
  }
  redirect("/onboarding/voice");
}
