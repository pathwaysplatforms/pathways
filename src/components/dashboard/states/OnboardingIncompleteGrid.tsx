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

/** Card A (accent onboarding progress) + Card B (getting started checklist) for the onboarding_incomplete state. */
export function OnboardingIncompleteGrid({ data }: Props) {
  const pct = data.profileCompleteness;
  const missingCount = data.incompleteFields.length;
  const visibleFields = data.incompleteFields.slice(0, 4);

  return (
    <>
      {/* Card A — Onboarding Progress */}
      <div
        className="card-accent h-full flex flex-col"
        style={{ padding: '18px' }}
      >
        <p
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          Onboarding Progress
        </p>
        <p
          style={{
            fontSize: '48px',
            fontWeight: 800,
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
            height: '3px',
            background: 'rgba(255,255,255,0.25)',
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
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
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
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.35)',
            borderRadius: '10px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Complete profile →
        </Link>
      </div>

      {/* Card B — Getting Started */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card"
        style={{
          background: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-card-md)',
          padding: '18px',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
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
                    border: '1.5px solid var(--color-accent-500)',
                    flexShrink: 0,
                  }}
                />
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  {toReadableLabel(field)}
                </p>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              All sections complete.
            </p>
          )}
        </div>

        <Link
          href="/onboarding/review"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--color-accent-600)',
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
