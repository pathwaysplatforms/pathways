import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { DashboardData } from '@/modules/dashboard/types';

interface Props {
  data: DashboardData;
}

/** Card A (application / pathway selection) + Card B (locked documents) for the pathway_not_selected state. */
export function PathwayNotSelectedGrid({ data }: Props) {
  const crs = data.profileCompleteness > 0 ? data.profileCompleteness : null;
  const topPct = crs !== null ? Math.max(1, 100 - Math.round(crs / 12)) : null;
  const topRec = data.recommendedPathways[0] ?? null;

  return (
    <>
      {/* Card A — Application / Pathway Selection */}
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
          Application
        </p>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            marginTop: 4,
            flexShrink: 0,
          }}
        >
          Select a Pathway
        </p>

        {/* CRS mini-stat row */}
        {crs !== null && (
          <div className="flex items-center gap-3 mt-3 flex-shrink-0">
            <div>
              <p style={{ fontSize: '28px', fontWeight: 300, color: 'var(--color-text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                {crs}
              </p>
              <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                CRS score
              </p>
            </div>
            <div style={{ width: '0.5px', alignSelf: 'stretch', background: 'var(--color-border-light)', margin: '2px 0' }} />
            {topPct !== null && (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#0FA896' }} />
                  <p style={{ fontSize: '12px', color: '#0B7269', fontWeight: 600 }}>Top {topPct}%</p>
                </div>
                <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 2 }}>of pool</p>
              </div>
            )}
          </div>
        )}

        {topRec && (
          <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: 8, flex: 1, overflow: 'hidden' }}>
            Recommended:{' '}
            <span style={{ color: 'var(--color-accent-600)', fontWeight: 600 }}>{topRec.name}</span>
          </p>
        )}
        {!topRec && <div style={{ flex: 1 }} />}

        <Link
          href="/pathways"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--color-accent-500)',
            borderRadius: '10px',
            textDecoration: 'none',
            flexShrink: 0,
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          Browse pathways →
        </Link>
      </div>

      {/* Card B — Documents (locked) */}
      <div
        className="h-full flex flex-col items-center justify-center overflow-hidden rounded-card"
        style={{
          background: 'var(--color-bg-surface)',
          boxShadow: 'var(--shadow-card-md)',
          padding: '18px',
        }}
      >
        <Lock size={28} className="text-text-disabled" style={{ marginBottom: 10 }} />
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
          Documents
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          Unlocks after selecting a pathway
        </p>
      </div>
    </>
  );
}
