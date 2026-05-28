import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/modules/auth/service';
import { matchPathways } from '@/modules/pathways/service';
import type { MatchResult } from '@/modules/pathways/types';
import { MatchList } from '@/components/matching/MatchList';
import { createRequestLogger } from '@/lib/logger';

/**
 * Server component: runs the pathway matcher and renders ranked MatchCards.
 * Only the "Select pathway" button inside each card is client-side.
 */
export default async function MatchesPage() {
  const profile = await getProfile();

  if (!profile || profile.onboarding_status !== 'complete') {
    redirect('/onboarding');
  }

  const correlationId = `matches-${profile.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);

  let matches: MatchResult[] = []
  try {
    matches = await matchPathways(profile.id, logger);
  } catch {
    matches = [];
  }

  return (
    <main className="min-h-screen bg-bg-base">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors mb-6"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          ← My Dashboard
        </Link>

        {/* Page header */}
        <div className="mb-8">
          <p className="label-eyebrow mb-2">Onboarding</p>
          <h1
            className="text-text-primary font-bold"
            style={{ fontSize: '28px', letterSpacing: '-0.02em', lineHeight: 1.2 }}
          >
            Your Pathway Matches
          </h1>
          <p className="text-text-secondary mt-2" style={{ fontSize: '15px', lineHeight: '1.6' }}>
            Based on your profile, here are the immigration pathways you may be eligible for.
          </p>
        </div>

        <MatchList matches={matches} />

      </div>
    </main>
  );
}
