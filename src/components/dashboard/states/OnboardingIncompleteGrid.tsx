import Link from 'next/link';
import type { DashboardData } from '@/modules/dashboard/types';

interface Props {
  data: DashboardData;
}

const FIELD_LABELS: Record<string, string> = {
  full_name:          'Full name',
  nationality:        'Nationality',
  current_country:    'Current country',
  education_level:    'Education level',
  has_degree:         'Degree status',
  degree_level:       'Degree level',
  degree_field:       'Field of study',
  years_experience:   'Work experience',
  occupation:         'Occupation',
  noc_teer_category:  'NOC / TEER category',
  english_level:      'English level',
  clb_listening:      'CLB listening',
  clb_reading:        'CLB reading',
  clb_speaking:       'CLB speaking',
  clb_writing:        'CLB writing',
  annual_salary_gbp:  'Annual salary',
  marital_status:     'Marital status',
  has_dependents:     'Dependents',
};

function toReadableLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
}

/** Card A (ink progress card) + Card B (getting started checklist) for the onboarding_incomplete state. */
export function OnboardingIncompleteGrid({ data }: Props) {
  const pct = data.profileCompleteness;
  const missingCount = data.incompleteFields.length;
  const visibleFields = data.incompleteFields.slice(0, 4);

  return (
    <>
      {/* Card A — Onboarding Progress (ink dark) */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card"
        style={{ background: 'var(--pw-ink)', padding: '28px', position: 'relative' }}
      >
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '10px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.50)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          Onboarding Progress
        </p>
        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '48px',
            fontWeight: 400,
            color: '#fff',
            lineHeight: 1,
            marginTop: 6,
            flexShrink: 0,
          }}
        >
          {pct}%
        </p>
        {/* Progress bar */}
        <div
          style={{
            height: '2px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 9999,
            marginTop: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: '#fff',
              borderRadius: 9999,
            }}
          />
        </div>
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.55)',
            marginTop: 8,
            flex: 1,
          }}
        >
          {missingCount > 0
            ? `${missingCount} field${missingCount !== 1 ? 's' : ''} still needed`
            : 'Profile complete'}
        </p>
        <Link
          href="/onboarding/review"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--pw-ink)',
            background: '#fff',
            borderRadius: '9999px',
            textDecoration: 'none',
            flexShrink: 0,
            transition: 'opacity 150ms',
          }}
        >
          Complete profile →
        </Link>
      </div>

      {/* Card B — Getting Started */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card bg-white"
        style={{ border: '1px solid rgba(0,0,0,0.08)', padding: '28px' }}
      >
        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--pw-ink)',
            flexShrink: 0,
            marginBottom: 12,
          }}
        >
          Getting Started
        </p>

        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
          {visibleFields.length > 0 ? (
            visibleFields.map((field) => (
              <div key={field} className="flex items-center gap-2.5">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    border: '1.5px solid rgba(0,0,0,0.20)',
                    flexShrink: 0,
                  }}
                />
                <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', fontWeight: 400, color: 'var(--pw-muted)' }}>
                  {toReadableLabel(field)}
                </p>
              </div>
            ))
          ) : (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-muted)' }}>
              All sections complete.
            </p>
          )}
        </div>

        <Link
          href="/onboarding/review"
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--pw-accent)',
            textDecoration: 'none',
            flexShrink: 0,
            marginTop: 10,
          }}
        >
          Finish your profile →
        </Link>
      </div>
    </>
  );
}
