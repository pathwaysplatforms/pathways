import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { PathwayRecommendations } from "@/components/pathways/PathwayRecommendations";
import { BackButton } from "@/components/ui/BackButton";

/** Pathway match results — accessible only after onboarding is complete. */
export default async function PathwayResultsPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.onboarding_step !== "complete") {
    redirect("/onboarding");
  }

  return (
    <main
      className="min-h-screen py-20 px-6"
      style={{ background: "var(--pw-bg)", fontFamily: "var(--pw-font-body)" }}
    >
      <div className="max-w-4xl mx-auto">
        <BackButton href="/dashboard" />
        <div className="mb-10">
          <p className="pw-eyebrow mb-3">Your results</p>
          <h1
            className="text-3xl md:text-4xl text-pw-ink mb-3 leading-tight"
            style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
          >
            Your top pathway matches
          </h1>
          <p className="text-sm text-pw-muted leading-relaxed">
            Based on your profile, here are the immigration programs you qualify for — ranked by fit.
          </p>
        </div>
        <hr className="pw-rule mb-10" />
        <PathwayRecommendations />
      </div>
    </main>
  );
}
