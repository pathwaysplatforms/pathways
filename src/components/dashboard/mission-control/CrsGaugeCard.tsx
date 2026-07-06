'use client';

import type { CrsLever } from '@/modules/dashboard/mission-control';
import type { LatestDraw } from '@/modules/dashboard/types';

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 16,
  padding: '24px',
  // Fills the flex wrapper in the executing row so the two cards keep equal
  // heights; inert when the parent lays out as a block.
  width: '100%',
};

const CRS_MAX = 1200;

/** Formats an ISO date string as "D Mon YYYY". */
function formatDrawDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Rendered only with a live cutoff — a fill percentage against the
// theoretical 1200 maximum is meaningless without a reference marker.
function GaugeTrack({ score, cutoff }: { score: number; cutoff: number }) {
  const scorePct = Math.min(100, (score / CRS_MAX) * 100);
  const cutoffPct = Math.min(100, (cutoff / CRS_MAX) * 100);

  return (
    <div style={{ position: 'relative', paddingTop: 18 }}>
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: `${cutoffPct}%`,
          transform: 'translateX(-50%)',
          fontFamily: 'var(--pw-font-body)',
          fontSize: 10,
          color: 'var(--pw-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        cutoff {cutoff}
      </span>
      <div
        role="img"
        aria-label={`CRS score ${score} of ${CRS_MAX}, latest cutoff ${cutoff}`}
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
            background: 'var(--pw-accent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${cutoffPct}%`,
            top: -3,
            bottom: -3,
            width: 2,
            background: 'var(--pw-ink)',
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
}

function LeverList({ levers }: { levers: CrsLever[] }) {
  if (levers.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <p className="pw-eyebrow" style={{ marginBottom: 8 }}>Top levers</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {levers.map((lever) => (
          <li key={lever.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--pw-ink)',
                  margin: 0,
                }}
              >
                {lever.label}
              </p>
              {lever.deltaLabel !== null && (
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: 9999,
                    background: 'rgba(26, 86, 219, 0.08)',
                    color: 'var(--pw-accent)',
                    fontFamily: 'var(--pw-font-ui)',
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {lever.deltaLabel}
                </span>
              )}
            </div>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 12,
                color: 'var(--pw-muted)',
                lineHeight: 1.5,
                margin: '2px 0 0',
              }}
            >
              {lever.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface CrsGaugeCardProps {
  crsScore: number | null;
  latestDraw: LatestDraw | null;
  crsGap: number | null;
  levers: CrsLever[];
}

/**
 * Executing-state CRS position card: score vs the latest same-stream cutoff
 * plus headroom-ranked levers. Degrades cleanly — no gauge without a score,
 * and without a live draw the bar disappears entirely in favour of a
 * no-live-cutoff status line; nothing invents a target.
 */
export function CrsGaugeCard({ crsScore, latestDraw, crsGap, levers }: CrsGaugeCardProps) {
  return (
    <section style={CARD} aria-label="CRS position">
      <p className="pw-eyebrow" style={{ marginBottom: 10 }}>CRS position</p>

      {crsScore !== null ? (
        <>
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
              {crsScore}
            </span>
            {crsGap !== null && (
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 9999,
                  fontFamily: 'var(--pw-font-ui)',
                  fontSize: 11,
                  fontWeight: 500,
                  background: crsGap >= 0 ? '#F0FDF4' : '#FEF3C7',
                  color: crsGap >= 0 ? '#16A34A' : '#D97706',
                }}
              >
                {crsGap >= 0 ? `+${crsGap} above cutoff` : `${crsGap} to cutoff`}
              </span>
            )}
          </div>
          {latestDraw !== null ? (
            <>
              <GaugeTrack score={crsScore} cutoff={latestDraw.cutoffScore} />
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 11,
                  color: 'var(--pw-muted)',
                  margin: '8px 0 0',
                }}
              >
                Latest {latestDraw.drawType ?? 'Express Entry'} draw · {formatDrawDate(latestDraw.drawDate)}
              </p>
            </>
          ) : (
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 12,
                color: 'var(--pw-muted)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              No live cutoff for this stream right now — IRCC&rsquo;s recent draws have
              targeted specific categories and provincial nominees.
            </p>
          )}
        </>
      ) : (
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 13,
            color: 'var(--pw-muted)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Add language, education, and work details to your profile to see your CRS estimate.
        </p>
      )}

      <LeverList levers={levers} />
    </section>
  );
}

/**
 * Discovering-state CRS card: the bare estimate only — no cutoff, no gap,
 * per the orientation-not-comparison rule for uncommitted users.
 */
export function CrsNumberCard({ crsScore }: { crsScore: number | null }) {
  return (
    <section style={CARD} aria-label="CRS estimate">
      <p className="pw-eyebrow" style={{ marginBottom: 10 }}>Your CRS estimate</p>
      {crsScore !== null ? (
        <span
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: 36,
            fontWeight: 400,
            color: 'var(--pw-ink)',
            lineHeight: 1,
          }}
        >
          {crsScore}
        </span>
      ) : (
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 13,
            color: 'var(--pw-muted)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Add language, education, and work details to your profile to see your CRS estimate.
        </p>
      )}
    </section>
  );
}
