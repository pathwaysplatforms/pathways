import type { FswEstimate } from '@/lib/fsw-points';
import { FSW_FACTOR_CAPS, FSW_FACTOR_LABELS } from '@/lib/fsw-points';

const FSW_MINIMUM = 67;
const FSW_MAX = 100;

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 16,
  padding: '20px 24px',
  width: '100%',
};

interface FswEligibilityCardProps {
  estimate: FswEstimate;
}

/**
 * Compact addendum strip showing the FSW 67-point selection-grid result.
 * Rendered alongside — never instead of — the CRS position card: FSW
 * eligibility is a one-time pass/fail gate on applying under the category,
 * while CRS is the ongoing ranking that actually determines invitations.
 * The two numbers measure different things, so the card says so explicitly
 * rather than leaving a reader to infer whether they agree or conflict.
 */
export function FswEligibilityCard({ estimate }: FswEligibilityCardProps) {
  const { score, breakdown, eligible, ineligibleReason } = estimate;
  const scorePct = Math.min(100, (score / FSW_MAX) * 100);
  const minimumPct = (FSW_MINIMUM / FSW_MAX) * 100;

  const statusColor = eligible ? '#16A34A' : '#D97706';
  const statusBg = eligible ? '#F0FDF4' : '#FEF3C7';
  const statusLabel = eligible ? 'Eligible' : 'Not yet eligible';

  return (
    <section style={CARD} aria-label="FSW eligibility">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 auto' }}>
          <p className="pw-eyebrow" style={{ marginBottom: 8 }}>FSW eligibility (67-point grid)</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: 28,
                fontWeight: 400,
                color: 'var(--pw-ink)',
                lineHeight: 1,
              }}
            >
              {score}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 9999,
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 11,
                fontWeight: 500,
                background: statusBg,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <p
          style={{
            flex: '1 1 260px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: 12,
            color: 'var(--pw-muted)',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 420,
          }}
        >
          Confirms you qualify to apply under FSW. Your CRS score above is what determines
          whether you actually receive an invitation.
        </p>
      </div>

      {/* Score bar with 67-pt threshold marker */}
      <div style={{ position: 'relative', paddingTop: 16, marginTop: 14 }}>
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: `${minimumPct}%`,
            transform: 'translateX(-50%)',
            fontFamily: 'var(--pw-font-body)',
            fontSize: 10,
            color: 'var(--pw-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          min {FSW_MINIMUM}
        </span>
        <div
          role="img"
          aria-label={`FSW score ${score} of ${FSW_MAX}, minimum required ${FSW_MINIMUM}`}
          style={{
            position: 'relative',
            height: 6,
            borderRadius: 9999,
            background: '#E5E7EB',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${scorePct}%`,
              borderRadius: 9999,
              background: eligible ? 'var(--pw-accent)' : '#F59E0B',
            }}
          />
          {/* Minimum threshold marker */}
          <div
            style={{
              position: 'absolute',
              left: `${minimumPct}%`,
              top: -3,
              bottom: -3,
              width: 2,
              background: 'var(--pw-ink)',
              borderRadius: 1,
            }}
          />
        </div>
      </div>

      {ineligibleReason && (
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 12,
            color: '#D97706',
            lineHeight: 1.5,
            margin: '10px 0 0',
          }}
        >
          {ineligibleReason}
        </p>
      )}

      {/* Per-factor breakdown, condensed to a single wrapping line rather
          than the vertical list a full-width column card could afford. */}
      <ul
        style={{
          listStyle: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          margin: '14px 0 0',
          padding: '12px 0 0',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {(Object.keys(FSW_FACTOR_LABELS) as (keyof typeof FSW_FACTOR_LABELS)[]).map((key) => (
          <li
            key={key}
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 12,
              color: 'var(--pw-muted)',
            }}
          >
            {FSW_FACTOR_LABELS[key]}{' '}
            <span style={{ color: breakdown[key] > 0 ? 'var(--pw-ink)' : 'var(--pw-muted)', fontWeight: 500 }}>
              {breakdown[key]}/{FSW_FACTOR_CAPS[key]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
