'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/fx/AnimatedNumber';

interface CrsChipProps {
  crsValue: string;
}

/** Clickable CRS score chip that links to /dashboard/crs with a hover hint. */
export function CrsChip({ crsValue }: CrsChipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Link href="/dashboard/crs" style={{ display: 'block', textDecoration: 'none' }}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: hovered ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
            borderRadius: 10,
            padding: '10px 16px',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
        >
          <p className="pw-eyebrow" style={{ marginBottom: 2 }}>CRS Score</p>
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: '36px',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: 'var(--pw-ink)',
            }}
          >
            {Number.isFinite(Number(crsValue)) ? (
              <AnimatedNumber value={Number(crsValue)} durationMs={800} startInView={false} />
            ) : (
              crsValue
            )}
          </p>
        </div>
      </Link>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 4,
          fontFamily: 'var(--pw-font-body)',
          fontSize: 10,
          color: 'var(--pw-muted)',
          whiteSpace: 'nowrap',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: 'none',
        }}
      >
        View full breakdown →
      </div>
    </div>
  );
}
