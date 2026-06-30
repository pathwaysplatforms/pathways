import Link from 'next/link';
import type { MatchResult } from '@/modules/pathways/types';
import { MatchCard } from './MatchCard';

interface Props {
  matches: MatchResult[];
}

/** Renders the ranked list of MatchCards with optional incomplete-profile banner. */
export function MatchList({ matches }: Props) {
  const hasMissingData = matches.some((m) => m.missing_data.length > 0);
  const hasEligible = matches.some((m) => m.eligible);

  if (matches.length === 0) {
    return (
      <div
        className="bg-bg-surface rounded-card border border-border-light p-8 text-center"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <p className="text-text-primary font-bold mb-2" style={{ fontSize: '16px' }}>
          No matching pathways found
        </p>
        <p className="text-text-secondary mb-5" style={{ fontSize: '14px', lineHeight: '1.6' }}>
          We couldn&apos;t find any matching pathways based on your current profile.
          Try completing more of your profile, or speak to an advisor.
        </p>
        <Link href="/onboarding/review" className="btn-primary" style={{ fontSize: '14px' }}>
          Complete your profile →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Incomplete profile banner */}
      {hasMissingData && (
        <div
          className="flex items-start justify-between gap-4 rounded-card border border-border-light px-5 py-4"
          style={{ background: 'var(--color-bg-subtle)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-semibold" style={{ fontSize: '13px' }}>
              Some profile information is incomplete
            </p>
            <p className="text-text-tertiary mt-0.5" style={{ fontSize: '12px' }}>
              Complete your profile to see more accurate matches and a full CRS score.
            </p>
          </div>
          <Link
            href="/onboarding/review"
            className="btn-secondary flex-shrink-0"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            Complete profile →
          </Link>
        </div>
      )}

      {/* Eligible pathways first */}
      {matches.filter((m) => m.eligible).map((match) => (
        <MatchCard key={match.pathway.id} match={match} />
      ))}

      {/* Ineligible pathways (if any) */}
      {!hasEligible && matches.filter((m) => !m.eligible).map((match) => (
        <MatchCard key={match.pathway.id} match={match} />
      ))}
      {hasEligible && matches.some((m) => !m.eligible) && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-border-light" />
            <p className="label-eyebrow flex-shrink-0">Other pathways</p>
            <div className="flex-1 border-t border-border-light" />
          </div>
          {matches.filter((m) => !m.eligible).map((match) => (
            <MatchCard key={match.pathway.id} match={match} />
          ))}
        </>
      )}
    </div>
  );
}
