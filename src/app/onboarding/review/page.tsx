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

  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data: session } = await db
    .from("voice_sessions")
    .select("id")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const voiceSessionId = (session as { id: string } | null)?.id ?? null;

  const pathwayInput = buildPathwayInput(profile.id, extracted, voiceSessionId);
  const crsEstimate = computeCrsEstimate(pathwayInput);

  return (
    <main
      className="min-h-screen flex flex-col items-center py-12 px-4"
      style={{ background: "var(--pw-bg)", fontFamily: "var(--pw-font-body)" }}
    >
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-2">
          <span
            className="text-pw-ink text-lg"
            style={{ fontFamily: "var(--pw-font-display)" }}
          >
            Pathways
          </span>
        </div>

        {/* Progress hairline */}
        <div className="w-full h-px mt-4 mb-8" style={{ background: "rgba(0,0,0,0.08)" }}>
          <div className="h-px bg-pw-ink" style={{ width: "66%" }} />
        </div>

        <p className="pw-eyebrow mb-3">Step 3 of 3</p>
        <h1
          className="text-3xl md:text-4xl text-pw-ink mb-2 leading-tight"
          style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
        >
          Review your profile
        </h1>
        <p className="text-sm text-pw-muted mb-8 leading-relaxed">
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
