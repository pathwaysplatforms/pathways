import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import { getDashboardData } from "@/modules/dashboard/service";
import { MyPathwayWidget } from "@/components/dashboard/MyPathwayWidget";
import { CrsScoreWidget } from "@/components/dashboard/CrsScoreWidget";
import { DocumentsWidget } from "@/components/dashboard/DocumentsWidget";
import { NextDrawWidget } from "@/components/dashboard/NextDrawWidget";

/** Dashboard home — 2×2 widget grid for users who have completed onboarding. */
export default async function DashboardPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/auth/login");
  }

  if (profile.onboarding_status === "not_started") {
    redirect("/onboarding");
  }

  if (profile.onboarding_status === "voice_complete") {
    redirect("/onboarding/review");
  }

  const correlationId = crypto.randomUUID();
  const { profile: dashProfile, draw } = await getDashboardData(correlationId);

  return (
    <main className="min-h-screen bg-bg-dashboard px-6 py-10 md:px-10">
      {/* Page header */}
      <header className="mb-8">
        <h1 className="font-jakarta text-2xl text-neutral-900">
          Good to have you back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.
        </h1>
        <p className="font-dm-sans text-sm text-neutral-400 mt-1">
          {dashProfile.destination_country} via {dashProfile.pathway.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
      </header>

      {/* Widget grid */}
      <div className="flex flex-col gap-5">
        {/* Row 1: My Pathway (58%) + CRS Score (42%) */}
        <div className="dash-row-top">
          <MyPathwayWidget profile={dashProfile} />
          <CrsScoreWidget profile={dashProfile} draw={draw} />
        </div>

        {/* Row 2: Documents (42%) + Next Draw (58%) */}
        <div className="dash-row-bottom">
          <DocumentsWidget profile={dashProfile} />
          <NextDrawWidget profile={dashProfile} draw={draw} />
        </div>
      </div>
    </main>
  );
}
