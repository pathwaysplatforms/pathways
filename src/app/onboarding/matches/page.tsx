import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";

/** Pathway matches stub — shown after the user confirms their review. */
export default async function MatchesPage() {
  const profile = await getProfile();
  if (!profile || profile.onboarding_status !== "complete") {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-medium text-neutral-900">Your pathways are ready</h1>
        <p className="text-sm text-neutral-500">
          We&apos;re matching your profile to the best immigration routes.
          This feature is coming soon.
        </p>
        <a
          href="/dashboard"
          className="inline-block h-10 px-6 rounded-md bg-blue-600 text-white text-sm font-medium leading-10 hover:bg-blue-700 transition-colors"
        >
          Go to dashboard
        </a>
      </div>
    </main>
  );
}
