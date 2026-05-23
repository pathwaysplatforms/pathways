import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { ReviewClient } from "./review-client";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

/** Review and confirm the extracted profile from the voice session. */
export default async function ReviewPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.onboarding_status === "complete") {
    redirect("/onboarding/matches");
  }

  const extracted = (profile.voice_session_data ?? {}) as Partial<VoiceExtractedProfile>;

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-medium text-neutral-900 mb-1">
          Check your details
        </h1>
        <p className="text-sm text-neutral-600 mb-8">
          Review what we gathered from your conversation. Edit anything that looks off, then confirm.
        </p>
        <ReviewClient extracted={extracted} />
      </div>
    </main>
  );
}
