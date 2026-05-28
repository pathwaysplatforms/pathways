import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { DashboardData } from '@/modules/dashboard/types';

interface Props {
  data: DashboardData;
}

function formatSubmittedDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Card A (submission confirmed) + Card B (key dates) for the application_submitted state. */
export function ApplicationSubmittedGrid({ data }: Props) {
  const appHref = data.applicationId ? `/applications/${data.applicationId}` : '/dashboard';
  const submittedDate = formatSubmittedDate(data.applicationSubmittedAt);

  return (
    <>
      {/* Card A — Submission Confirmed */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card"
        style={{
          background: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-card-md)',
          padding: '18px',
          borderLeft: '3px solid #22C55E',
        }}
      >
        <CheckCircle2
          size={24}
          style={{ color: '#22C55E', flexShrink: 0 }}
        />
        <p
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          Application Submitted
        </p>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            marginTop: 5,
            flex: 1,
          }}
        >
          Your application has been submitted to IRCC.
        </p>
        <p
          style={{
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
            marginBottom: 10,
          }}
        >
          Submitted {submittedDate}
        </p>
        <Link href={appHref} className="btn-secondary" style={{ fontSize: '13px', padding: '7px 14px' }}>
          View application →
        </Link>
      </div>

      {/* Card B — Key Dates */}
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
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          What&apos;s Next
        </p>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            marginTop: 4,
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          Key Dates
        </p>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2.5">
          {[
            { dot: '#F59E0B', label: 'Biometrics deadline', value: '—' },
            { dot: '#3B82F6', label: 'Medical exam window', value: '—' },
            { dot: '#0FA896', label: 'Est. IRCC decision',  value: '—' },
          ].map(({ dot, label, value }, i) => (
            <div
              key={label}
              style={{
                paddingBottom: 8,
                borderBottom: i < 2 ? '0.5px solid var(--color-border-light)' : 'none',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dot }}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{label}</p>
                </div>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: value === '—' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                  }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
