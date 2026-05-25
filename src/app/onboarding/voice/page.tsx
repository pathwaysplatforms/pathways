import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { VoiceClient } from "./voice-client";

/** Full-screen voice onboarding interface — no sidebar, no nav. */
export default async function VoicePage() {
  const profile = await getProfile();
  if (
    profile?.onboarding_status === "voice_complete" ||
    profile?.onboarding_status === "complete"
  ) {
    redirect("/onboarding/review");
  }

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-neutral-50">
      <VoiceClient />
    </main>
  );
}
