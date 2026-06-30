import { Check, X, Clock } from 'lucide-react';
import type { MatchResult } from '@/modules/pathways/types';
import { CrsScoreBar } from './CrsScoreBar';
import { SelectPathwayButton } from './SelectPathwayButton';

interface Props {
  match: MatchResult;
}

// ITA likelihood badge colours — using design system status tokens
const LIKELIHOOD_CONFIG = {
  high:    { label: 'High ITA chance',    badgeClass: 'badge-success'  },
  medium:  { label: 'Medium ITA chance',  badgeClass: 'badge-warning'  },
  low:     { label: 'Lower ITA chance',   badgeClass: 'badge-info'     },
  unknown: { label: 'Score unknown',      badgeClass: ''               },
} as const;

/** Single pathway match card — eligible or ineligible. */
export function MatchCard({ match }: Props) {
  const { pathway, eligible, crs_score, ita_likelihood, latest_cutoff, criteria_met, criteria_missing } = match;
  const likelihood = LIKELIHOOD_CONFIG[ita_likelihood];

  return (
    <div
      className={[
        'bg-bg-surface rounded-card border border-border-light transition-opacity',
        !eligible ? 'opacity-60' : '',
      ].join(' ')}
      style={{ boxShadow: 'var(--shadow-card)', padding: '24px' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h2
            className="text-text-primary font-bold leading-snug"
            style={{ fontSize: '18px', letterSpacing: '-0.01em' }}
          >
            {pathway.title}
          </h2>
          <p className="text-text-tertiary mt-0.5" style={{ fontSize: '12px' }}>
            {pathway.official_name}
          </p>
        </div>
        {eligible ? (
          <span className={`badge ${likelihood.badgeClass} flex-shrink-0`}>
            {likelihood.label}
          </span>
        ) : (
          <span className="badge flex-shrink-0" style={{
            background: 'var(--color-bg-subtle)',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border-light)',
          }}>
            Not currently eligible
          </span>
        )}
      </div>

      {/* CRS score bar */}
      <div className="mb-5">
        <CrsScoreBar score={crs_score} cutoff={latest_cutoff} />
      </div>

      {/* Criteria */}
      {(criteria_met.length > 0 || criteria_missing.length > 0) && (
        <ul className="flex flex-col gap-1.5 mb-5">
          {criteria_met.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <Check size={14} className="text-accent-500 flex-shrink-0 mt-0.5" />
              <span className="text-text-secondary" style={{ fontSize: '13px' }}>{c}</span>
            </li>
          ))}
          {criteria_missing.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <X size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
              <span className="text-text-secondary" style={{ fontSize: '13px' }}>{c}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Processing time */}
      <div className="flex items-center gap-1.5 mb-5">
        <Clock size={13} className="text-text-tertiary flex-shrink-0" />
        <span className="text-text-tertiary" style={{ fontSize: '12px' }}>
          Processing time: {pathway.processing_time_min}–{pathway.processing_time_max}
        </span>
      </div>

      <div className="border-t border-border-light pt-4">
        {eligible ? (
          <div className="flex items-center gap-3 flex-wrap">
            <SelectPathwayButton pathwayId={pathway.id} />
            <a
              href={`/pathway/${pathway.slug}`}
              className="btn-secondary"
              style={{ fontSize: '13px' }}
            >
              Learn more
            </a>
          </div>
        ) : (
          <p className="text-text-tertiary" style={{ fontSize: '13px' }}>
            Address the missing criteria above to become eligible for this pathway.
          </p>
        )}
      </div>
    </div>
  );
}
