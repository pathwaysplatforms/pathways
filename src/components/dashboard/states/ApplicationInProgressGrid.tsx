import Link from 'next/link';
import type { DashboardData } from '@/modules/dashboard/types';

interface Props {
  data: DashboardData;
}

interface WalletCardDef {
  gradient: string;
  label: string;
  badge: string | null;
  rotate: number;
}

const WALLET_FALLBACK: WalletCardDef[] = [
  {
    gradient: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)',
    label: '',
    badge: null,
    rotate: -5,
  },
  {
    gradient: 'linear-gradient(135deg, #D4A017 0%, #B8860B 100%)',
    label: 'ECA ASSESSMENT',
    badge: null,
    rotate: -3.5,
  },
  {
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    label: 'POLICE CERTIFICATE',
    badge: 'Pending',
    rotate: -2.5,
  },
  {
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    label: 'LANGUAGE SCORES',
    badge: 'Expiring',
    rotate: -1.5,
  },
  {
    gradient: 'linear-gradient(135deg, #2D2D2D 0%, #0D0D0D 100%)',
    label: 'PASSPORT',
    badge: 'Valid',
    rotate: 0,
  },
];

function buildWalletCards(documents: DashboardData['documents']): WalletCardDef[] {
  if (!documents.length) return WALLET_FALLBACK;

  const STATUS_COLORS: Record<string, string> = {
    verified: 'linear-gradient(135deg, #2D2D2D 0%, #0D0D0D 100%)',
    uploaded: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    pending:  'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    expiring: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  };

  const cards = documents.slice(0, 5).map((doc, i): WalletCardDef => ({
    gradient: STATUS_COLORS[doc.status.toLowerCase()] ?? 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)',
    label: doc.name.toUpperCase(),
    badge: doc.status.charAt(0).toUpperCase() + doc.status.slice(1),
    rotate: [-5, -3.5, -2.5, -1.5, 0][i] ?? 0,
  }));

  while (cards.length < 5) {
    cards.unshift({ ...WALLET_FALLBACK[0], rotate: -5 });
  }
  return cards;
}

/** Card A (ink progress card) + Card B (document wallet) for the application_in_progress state. */
export function ApplicationInProgressGrid({ data }: Props) {
  const pct =
    data.totalStepsCount > 0
      ? Math.round((data.completedStepsCount / data.totalStepsCount) * 100)
      : 0;

  const currentStep = data.applicationSteps.find((s) => s.status === 'current');
  const stepLabel = currentStep
    ? `Step ${currentStep.stepNumber} of ${data.totalStepsCount} · ${currentStep.label}`
    : `${data.completedStepsCount} of ${data.totalStepsCount} steps complete`;

  const appHref = '/dashboard/application';
  const docsHref = data.applicationId ? `/applications/${data.applicationId}/documents` : '#';

  const walletCards = buildWalletCards(data.documents);

  return (
    <>
      {/* Card A — Application Progress (ink dark) */}
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
            overflow: 'hidden',
          }}
        >
          {stepLabel}
        </p>
        <Link
          href={appHref}
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
          Open application →
        </Link>
      </div>

      {/* Card B — Documents Wallet */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card bg-white"
        style={{ border: '1px solid rgba(0,0,0,0.08)', padding: '28px' }}
      >
        <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '16px', fontWeight: 400, color: 'var(--pw-ink)' }}>
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
          >
            See all
          </Link>
        </div>

        {/* Document stack — overlapping cards anchored to bottom */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {walletCards.map((card, i) => {
            const frontIdx = walletCards.length - 1;
            const peek = 22;
            const cardHeight = 52;
            const bottomOffset = (frontIdx - i) * peek;
            return (
              <div
                key={i}
                className="absolute left-0 right-0 flex items-center rounded-xl"
                style={{
                  background: card.gradient,
                  height: cardHeight,
                  bottom: bottomOffset,
                  zIndex: i + 1,
                  padding: '0 14px',
                  gap: 8,
                  boxShadow: '0 -2px 8px rgba(0,0,0,0.18)',
                }}
              >
                {card.label ? (
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.9)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {card.label}
                  </p>
                ) : (
                  <div style={{ flex: 1 }} />
                )}
                {card.badge && (
                  <span
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '9px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.85)',
                      background: 'rgba(255,255,255,0.2)',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {card.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
