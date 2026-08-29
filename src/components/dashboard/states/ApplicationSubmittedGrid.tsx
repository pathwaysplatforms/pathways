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
        className="h-full flex flex-col overflow-hidden rounded-card bg-white"
        style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderLeft: '3px solid #22C55E',
          padding: '28px',
        }}
      >
        <CheckCircle2
          size={24}
          style={{ color: '#22C55E', flexShrink: 0 }}
        />
        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--pw-ink)',
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          Application Submitted
        </p>
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '11px',
            color: 'var(--pw-muted)',
            marginTop: 5,
            flex: 1,
          }}
        >
          Your application has been submitted to IRCC.
        </p>
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '11px',
            color: 'var(--pw-muted)',
            flexShrink: 0,
            marginBottom: 10,
          }}
        >
          Submitted {submittedDate}
        </p>
        <Link
          href={appHref}
          className="pw-btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '7px 16px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--pw-ink)',
            background: 'transparent',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: '9999px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          View application →
        </Link>
      </div>

      {/* Card B — Key Dates */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card bg-white"
        style={{ border: '1px solid rgba(0,0,0,0.08)', padding: '28px' }}
      >
        <p className="pw-eyebrow" style={{ flexShrink: 0 }}>What&apos;s Next</p>
        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--pw-ink)',
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
            { dot: 'var(--pw-accent)', label: 'Est. IRCC decision',  value: '—' },
          ].map(({ dot, label, value }, i) => (
            <div
              key={label}
              style={{
                paddingBottom: 8,
                borderBottom: i < 2 ? '0.5px solid rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dot }}
                  />
                  <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-muted)' }}>{label}</p>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: value === '—' ? 'var(--pw-muted)' : 'var(--pw-ink)',
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
