import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { DashboardData, DashboardDocument } from '@/modules/dashboard/types';

interface Props {
  data: DashboardData;
}

/** Priority order for document urgency sort. Lower number = shown first. */
function urgencyRank(status: string): number {
  const s = status.toLowerCase();
  if (s === 'rejected' || s === 'expired') return 0;
  if (s === 'expiring') return 1;
  if (s === 'pending' || s === 'missing') return 2;
  if (s === 'uploaded') return 3;
  if (s === 'verified') return 4;
  return 3;
}

function urgencyDotColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'rejected' || s === 'expired') return '#DC2626';
  if (s === 'expiring') return '#D97706';
  if (s === 'pending' || s === 'missing') return '#D97706';
  if (s === 'verified') return '#16A34A';
  return '#16A34A';
}

function urgencyLabel(status: string): string | null {
  const s = status.toLowerCase();
  if (s === 'rejected' || s === 'expired') return 'Expired';
  if (s === 'expiring') return 'Expiring soon';
  if (s === 'pending' || s === 'missing') return 'Required for next step';
  return null;
}

function sortByUrgency(docs: DashboardDocument[]): DashboardDocument[] {
  return [...docs].sort((a, b) => urgencyRank(a.status) - urgencyRank(b.status));
}

function DocumentsSection({ data }: { data: DashboardData }) {
  // Documents are user-scoped (one application per user), so the canonical
  // /dashboard/documents tab serves them; no applicationId param needed.
  const docsHref = data.applicationId ? '/dashboard/documents' : '/dashboard/application';

  // No documents yet — show data-pending state
  if (data.documents.length === 0) {
    return (
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
            marginBottom: 10,
          }}
        >
          Documents
        </p>
        <div
          className="flex flex-col flex-1 items-center justify-center gap-2"
          style={{
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 10,
            background: '#FAFAFA',
            padding: '12px 10px',
          }}
        >
          <Clock size={18} style={{ color: 'var(--pw-muted)' }} aria-hidden="true" />
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '11px',
              color: 'var(--pw-muted)',
              textAlign: 'center',
            }}
          >
            Documents unlock when your application starts
          </p>
        </div>
        <Link
          href={docsHref}
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--pw-accent)',
            textDecoration: 'none',
            flexShrink: 0,
            marginTop: 12,
          }}
          aria-label="Start application to unlock documents"
        >
          Start application →
        </Link>
      </div>
    );
  }

  const sorted = sortByUrgency(data.documents).slice(0, 5);

  return (
    <div
      className="h-full flex flex-col overflow-hidden rounded-card bg-white"
      style={{ border: '1px solid rgba(0,0,0,0.08)', padding: '28px' }}
    >
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 12 }}>
        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--pw-ink)',
          }}
        >
          Documents
        </p>
        <Link
          href={docsHref}
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--pw-accent)',
            textDecoration: 'none',
          }}
          aria-label="View all documents"
        >
          See all
        </Link>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
        {sorted.map((doc) => {
          const dot = urgencyDotColor(doc.status);
          const tag = urgencyLabel(doc.status);
          return (
            <div
              key={doc.id}
              className="flex items-start gap-2 flex-shrink-0"
              style={{
                paddingBottom: 6,
                borderBottom: '0.5px solid rgba(0,0,0,0.06)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: dot,
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <p
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '11px',
                    color: 'var(--pw-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {doc.name}
                </p>
                {tag && (
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '9px',
                      color: dot,
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Card A (compact progress + dominant CTA) + Card B (urgency-sorted documents) for in-progress states. */
export function ApplicationInProgressGrid({ data }: Props) {
  const completed = data.completedStepsCount;
  const total = data.totalStepsCount;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Resolve current step from either step list (selectedPathwaySteps is populated for pathway_selected)
  const currentStep =
    data.selectedPathwaySteps.find((s) => s.status === 'current') ??
    data.applicationSteps.find((s) => s.status === 'current');

  const ctaLabel = currentStep ? currentStep.label : 'Continue application';
  const appHref = '/dashboard/application';

  return (
    <>
      {/* Card A — compact progress + dominant CTA */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card"
        style={{ background: 'var(--pw-ink)', padding: '28px' }}
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
          Application Progress
        </p>

        {/* Compact step count */}
        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '28px',
            fontWeight: 400,
            color: '#fff',
            lineHeight: 1,
            marginTop: 8,
            flexShrink: 0,
          }}
        >
          {completed}
          <span
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '14px',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.55)',
              marginLeft: 4,
            }}
          >
            of {total} steps
          </span>
        </p>

        {/* Hairline progress track */}
        <div
          aria-label={`${pct}% complete`}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
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
              background: 'rgba(255,255,255,0.70)',
              borderRadius: 9999,
              transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>

        {/* Current step name */}
        {currentStep && (
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.55)',
              marginTop: 8,
              flex: 1,
              overflow: 'hidden',
            }}
          >
            Next: {currentStep.label}
          </p>
        )}
        {!currentStep && <div style={{ flex: 1 }} />}

        {/* Single dominant CTA — white fill on dark card */}
        <Link
          href={appHref}
          aria-label={ctaLabel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 20px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: '14px',
            fontWeight: 500,
            color: '#0A0A0A',
            background: '#FFFFFF',
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            transition: 'opacity 150ms',
          }}
        >
          {ctaLabel.length > 34 ? ctaLabel.slice(0, 31) + '…' : ctaLabel}
        </Link>
      </div>

      {/* Card B — urgency-sorted documents */}
      <DocumentsSection data={data} />
    </>
  );
}
