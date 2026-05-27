import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/modules/auth/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewClient } from "./review-client";
import { buildPathwayInput, computeCrsEstimate } from "@/lib/pathway-input";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

/** Review and confirm the extracted profile from the voice/chat/form session. */
export default async function ReviewPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.onboarding_step === "complete") {
    redirect("/onboarding/matches");
  }

  const extracted = (profile.voice_session_data ?? {}) as Partial<VoiceExtractedProfile>;

  // Look up the most recent voice session ID for this profile
  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: session } = await db
    .from("voice_sessions")
    .select("id")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const voiceSessionId = (session as { id: string } | null)?.id ?? null;

  // Compute CRS estimate for the review card
  const pathwayInput = buildPathwayInput(profile.id, extracted, voiceSessionId);
  const crsEstimate = computeCrsEstimate(pathwayInput);

  return (
    <main className="min-h-screen bg-bg-base flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-2">
          <span className="text-text-primary font-bold tracking-tight text-lg">Pathways</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mt-6 mb-1">
          Review your profile
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          Check that everything looks right before we find your pathways.
          Click any field to edit it inline.
        </p>
        <ReviewClient
          profileId={profile.id}
          extracted={extracted}
          voiceSessionId={voiceSessionId}
          crsEstimate={crsEstimate}
        />
      </div>
    </main>
  );
}
