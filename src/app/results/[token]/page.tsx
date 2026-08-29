import { notFound } from "next/navigation";
import { createRequestLogger } from "@/lib/logger";
import { getGuestSession } from "@/modules/guest/service";
import { PathwayResultsView } from "@/components/results/PathwayResultsView";

interface PageProps {
  params: Promise<{ token: string }>;
}

/** Pathway results for a guest session — public route, no auth required. */
export default async function ResultsPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  const log = createRequestLogger(crypto.randomUUID());

  let session;
  try {
    session = await getGuestSession(params.token, log);
  } catch {
    notFound();
  }

  if (!session.pathway_results) {
    // Results not yet available — show a loading/error state
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-base" style={{ fontFamily: "Urbanist, sans-serif" }}>
        <div className="text-center max-w-md px-6">
          <h1 className="text-xl font-bold text-text-primary mb-3">Still working on your results</h1>
          <p className="text-text-secondary text-sm">
            Your pathway matching is in progress. Please refresh in a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PathwayResultsView
      token={params.token}
      results={session.pathway_results}
      expiresAt={session.expires_at}
    />
  );
}
