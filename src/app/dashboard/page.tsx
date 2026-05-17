import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";

/** Dashboard home for users who have completed onboarding. */
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-medium text-neutral-900">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-neutral-500">
          Your immigration dashboard is being built. Check back soon.
        </p>
      </div>
    </main>
  );
}
