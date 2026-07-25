import type { FswEstimate } from '@/lib/fsw-points';
import { FSW_FACTOR_CAPS, FSW_FACTOR_LABELS } from '@/lib/fsw-points';

const FSW_MINIMUM = 67;
const FSW_MAX = 100;

const CARD: React.CSSProperties = {
  background: 'transparent',
  borderRadius: 16,
  padding: '24px',
  width: '100%',
};

function FactorRow({
  label,
  score,
  cap,
}: {
  label: string;
  score: number;
  cap: number;
}) {
  const pct = Math.min(100, (score / cap) * 100);
  return (
    <li style={{ padding: '7px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 12,
            color: 'var(--pw-muted)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--pw-font-ui)',
            fontSize: 11,
            fontWeight: 500,
            color: score > 0 ? 'var(--pw-ink)' : 'var(--pw-muted)',
          }}
        >
          {score} / {cap}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 9999,
          background: '#E5E7EB',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 9999,
            background: score > 0 ? 'var(--pw-accent)' : 'transparent',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </li>
  );
}

interface FswEligibilityCardProps {
  estimate: FswEstimate;
}

/**
 * Dashboard card showing the FSW 67-point selection factor score.
 * Rendered in place of the CRS gauge card when the user's pathway is FSW-family.
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
      <p className="pw-eyebrow" style={{ marginBottom: 10 }}>FSW eligibility</p>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: 36,
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

      {/* Score bar with 67-pt threshold marker */}
      <div style={{ position: 'relative', paddingTop: 18, marginBottom: 4 }}>
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

      {/* Per-factor breakdown */}
      <div style={{ marginTop: 16 }}>
        <p className="pw-eyebrow" style={{ marginBottom: 4 }}>Score breakdown</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {(Object.keys(FSW_FACTOR_LABELS) as (keyof typeof FSW_FACTOR_LABELS)[]).map((key) => (
            <FactorRow
              key={key}
              label={FSW_FACTOR_LABELS[key]}
              score={breakdown[key]}
              cap={FSW_FACTOR_CAPS[key]}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
