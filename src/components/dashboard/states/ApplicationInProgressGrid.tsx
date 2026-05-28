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
    gradient: 'linear-gradient(135deg, #0D8F80 0%, #0B7269 100%)',
    label: 'PASSPORT',
    badge: 'Valid',
    rotate: 0,
  },
];

function buildWalletCards(documents: DashboardData['documents']): WalletCardDef[] {
  if (!documents.length) return WALLET_FALLBACK;

  const STATUS_COLORS: Record<string, string> = {
    verified: 'linear-gradient(135deg, #0D8F80 0%, #0B7269 100%)',
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

/** Card A (accent progress) + Card B (document wallet) for the application_in_progress state. */
export function ApplicationInProgressGrid({ data }: Props) {
  const pct =
    data.totalStepsCount > 0
      ? Math.round((data.completedStepsCount / data.totalStepsCount) * 100)
      : 0;

  const currentStep = data.applicationSteps.find((s) => s.status === 'current');
  const stepLabel = currentStep
    ? `Step ${currentStep.stepNumber} of ${data.totalStepsCount} · ${currentStep.label}`
    : `${data.completedStepsCount} of ${data.totalStepsCount} steps complete`;

  const appHref = data.applicationId ? `/applications/${data.applicationId}` : '/dashboard';
  const docsHref = data.applicationId ? `/applications/${data.applicationId}/documents` : '#';

  const walletCards = buildWalletCards(data.documents);

  return (
    <>
      {/* Card A — Application Progress */}
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
          Application Progress
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
          Open application →
        </Link>
      </div>

      {/* Card B — Documents Wallet */}
      <div
        className="h-full flex flex-col overflow-hidden rounded-card"
        style={{
          background: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-card-md)',
          padding: '18px',
        }}
      >
        <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Documents
          </p>
          <Link
            href={docsHref}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-accent-600)',
              background: 'var(--color-accent-50)',
              padding: '3px 10px',
              borderRadius: '8px',
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
