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
        className="h-full flex flex-col overflow-hidden rounded-card bg-white"
        style={{ border: '1px solid rgba(0,0,0,0.08)', padding: '28px' }}
      >
        <p className="pw-eyebrow" style={{ flexShrink: 0 }}>Application</p>

        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: '18px',
            fontWeight: 400,
            color: 'var(--pw-ink)',
            marginTop: 6,
            flexShrink: 0,
          }}
        >
          Select a Pathway
        </p>

        {/* CRS mini-stat row */}
        {crs !== null && (
          <div className="flex items-center gap-3 mt-3 flex-shrink-0">
            <div>
              <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '28px', fontWeight: 400, color: 'var(--pw-ink)', lineHeight: 1 }}>
                {crs}
              </p>
              <p className="pw-eyebrow" style={{ marginTop: 2 }}>CRS score</p>
            </div>
            <div style={{ width: '0.5px', alignSelf: 'stretch', background: 'rgba(0,0,0,0.08)', margin: '2px 0' }} />
            {topPct !== null && (
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--pw-accent)' }} />
                  <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-ink)', fontWeight: 500 }}>Top {topPct}%</p>
                </div>
                <p className="pw-eyebrow" style={{ marginTop: 2 }}>of pool</p>
              </div>
            )}
          </div>
        )}

        {topRec && (
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '11px', color: 'var(--pw-muted)', marginTop: 8, flex: 1, overflow: 'hidden' }}>
            Recommended:{' '}
            <span style={{ color: 'var(--pw-accent)', fontWeight: 500 }}>{topRec.name}</span>
          </p>
        )}
        {!topRec && <div style={{ flex: 1 }} />}

        <Link
          href="/pathways"
          className="pw-btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '9px 18px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: '13px',
            fontWeight: 500,
            color: '#fff',
            background: 'var(--pw-ink)',
            borderRadius: '9999px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          Browse pathways →
        </Link>
      </div>

      {/* Card B — Documents (locked) */}
      <div
        className="h-full flex flex-col items-center justify-center overflow-hidden rounded-card bg-white"
        style={{ border: '1px solid rgba(0,0,0,0.08)', padding: '28px' }}
      >
        <Lock size={28} style={{ color: 'var(--pw-muted)', marginBottom: 10 }} />
        <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '16px', fontWeight: 400, color: 'var(--pw-ink)', marginBottom: 6 }}>
          Documents
        </p>
        <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-muted)', textAlign: 'center' }}>
          Unlocks after selecting a pathway
        </p>
      </div>
    </>
  );
}
