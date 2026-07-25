'use client';

import Link from 'next/link';
import { JOURNEY_PHASES } from '@/modules/dashboard/mission-control';
import type { JourneyPhaseId, PathwayAsk } from '@/modules/dashboard/mission-control';

const CARD: React.CSSProperties = {
  background: 'transparent',
  borderRadius: 16,
  padding: '24px',
};

function PhaseDot({ state }: { state: 'past' | 'current' | 'future' }) {
  if (state === 'past') {
    return (
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--pw-accent)', opacity: 0.4, flexShrink: 0,
      }} />
    );
  }
  if (state === 'current') {
    return (
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: 'var(--pw-accent)', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      border: '1.5px solid #D1D5DB', background: 'transparent', flexShrink: 0,
    }} />
  );
}

interface JourneyPhaseStripProps {
  phase: JourneyPhaseId;
  pathwayTitle: string | null;
  pathwayAsks: PathwayAsk[];
}

/**
 * Awareness strip: where the user sits on the six-phase journey, plus a
 * reference list of what the committed pathway asks for. Deliberately carries
 * no progress meter and no owed-counts; the vault link is a soft opt-in.
 */
export function JourneyPhaseStrip({ phase, pathwayTitle, pathwayAsks }: JourneyPhaseStripProps) {
  const currentIndex = JOURNEY_PHASES.findIndex((p) => p.id === phase);

  return (
    <section style={CARD} aria-label="Journey overview">
      <p className="pw-eyebrow" style={{ marginBottom: 14 }}>Your journey</p>

      <ol
        style={{
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          margin: 0,
          padding: 0,
        }}
      >
        {JOURNEY_PHASES.map((p, i) => {
          const state: 'past' | 'current' | 'future' =
            i < currentIndex ? 'past' : i === currentIndex ? 'current' : 'future';
          const isLast = i === JOURNEY_PHASES.length - 1;
          return (
            <li
              key={p.id}
              aria-current={state === 'current' ? 'step' : undefined}
              style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1, minWidth: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <PhaseDot state={state} />
                <span
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 12,
                    fontWeight: state === 'current' ? 500 : 400,
                    color: state === 'future' ? '#9CA3AF' : 'var(--pw-ink)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </span>
              </div>
              {!isLast && (
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: 1.5,
                    minWidth: 12,
                    margin: '0 10px',
                    background: i < currentIndex ? 'var(--pw-accent)' : '#E5E5E5',
                    opacity: i < currentIndex ? 0.35 : 1,
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {pathwayAsks.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <p className="pw-eyebrow" style={{ marginBottom: 8 }}>
            What {pathwayTitle ?? 'your pathway'} asks for
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 18px',
            }}
          >
            {pathwayAsks.map((ask) => (
              <li
                key={ask.name}
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 13,
                  color: 'var(--pw-ink)',
                  lineHeight: 1.6,
                }}
              >
                {ask.name}
                {!ask.isMandatory && (
                  <span style={{ color: 'var(--pw-muted)', fontSize: 12 }}> (optional)</span>
                )}
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/documents"
            style={{
              display: 'inline-block',
              marginTop: 12,
              fontFamily: 'var(--pw-font-body)',
              fontSize: 13,
              color: 'var(--pw-accent)',
              textDecoration: 'none',
            }}
          >
            Keep these in one place →
          </Link>
        </div>
      )}
    </section>
  );
}
