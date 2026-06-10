import { redirect } from 'next/navigation';
import { getProfile } from '@/modules/auth/service';
import type { PathwayInput } from '@/lib/pathway-input';
import { SwissPageShell } from '@/components/layout/SwissPageShell';
import { DrawParticleCanvas } from '@/components/draws/DrawParticleCanvas';

interface DrawRecord {
  date: string;
  type: string;
  invitations: number;
  cutoff: number;
}

const DRAWS_DATA: DrawRecord[] = [
  { date: '2026-05-14', type: 'No Job Offer – STEM',         invitations: 1200, cutoff: 491 },
  { date: '2026-04-30', type: 'Canadian Experience Class',   invitations: 4500, cutoff: 522 },
  { date: '2026-04-16', type: 'No Job Offer – General',      invitations: 3900, cutoff: 488 },
  { date: '2026-04-02', type: 'French Language Proficiency', invitations: 7000, cutoff: 379 },
  { date: '2026-03-19', type: 'No Job Offer – STEM',         invitations: 1500, cutoff: 503 },
  { date: '2026-03-05', type: 'No Job Offer – General',      invitations: 3200, cutoff: 479 },
];

function formatDate(iso: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = iso.split('-');
  const m = parseInt(parts[1] ?? '1', 10) - 1;
  return `${months[m] ?? ''} ${parts[2] ?? ''}, ${parts[0] ?? ''}`;
}

/** Express Entry draw history page with particle scatter canvas and data table. */
export default async function DrawsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/auth/login');

  const pathwayInput = profile.pathway_input_json as PathwayInput | null;
  const crsLow = pathwayInput?.crs_estimate.range_low ?? null;
  const crsHigh = pathwayInput?.crs_estimate.range_high ?? null;
  const hasScore = crsLow !== null && crsHigh !== null && (crsLow > 0 || crsHigh > 0);

  const qualifyCount = hasScore && crsLow !== null
    ? DRAWS_DATA.filter((d) => d.cutoff <= crsLow).length
    : 0;

  return (
    <SwissPageShell>
      <main className="max-w-6xl mx-auto px-6 py-20 relative z-10">

        {/* ── Header ── */}
        <div className="mb-16">
          <p className="pw-eyebrow pw-entry">EXPRESS ENTRY</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry pw-entry-delay-1" />
          <h1
            className="pw-entry pw-entry-delay-2 leading-tight mb-3"
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontWeight: 400,
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              color: 'var(--pw-ink)',
            }}
          >
            Draw history
          </h1>
          <p
            className="pw-entry pw-entry-delay-3"
            style={{
              fontFamily: 'var(--pw-font-body)',
              color: 'var(--pw-muted)',
              fontSize: '15px',
              maxWidth: '440px',
            }}
          >
            Recent invitation rounds from the Express Entry pool.
            Each cloud represents one draw.
          </p>
        </div>

        {/* ── Score context bar ── */}
        {hasScore && crsLow !== null && crsHigh !== null && (
          <div
            className="pw-entry pw-entry-delay-4 mb-12"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              paddingBottom: '20px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--pw-muted)',
                  marginBottom: '4px',
                }}
              >
                YOUR ESTIMATE
              </p>
              <p
                style={{
                  fontFamily: 'var(--pw-font-display)',
                  fontSize: '36px',
                  fontWeight: 400,
                  color: 'var(--pw-ink)',
                  lineHeight: 1,
                }}
              >
                {crsLow} – {crsHigh}
              </p>
            </div>
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: '14px', color: 'var(--pw-muted)' }}>
              <span
                style={{
                  fontFamily: 'var(--pw-font-display)',
                  fontSize: '36px',
                  fontWeight: 400,
                  color: 'var(--pw-accent)',
                  lineHeight: 1,
                  marginRight: '6px',
                }}
              >
                {qualifyCount}
              </span>
              draws you&apos;d qualify for
            </p>
          </div>
        )}

        {/* ── Particle canvas ── */}
        <div className="pw-entry pw-entry-delay-5 mb-16" style={{ position: 'relative' }}>
          <DrawParticleCanvas draws={DRAWS_DATA} userScore={crsLow ?? null} />
        </div>

        {/* ── Data table ── */}
        <div className="mb-12">
          <p className="pw-eyebrow pw-entry" style={{ animationDelay: '400ms' }}>DRAW DETAILS</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry" style={{ animationDelay: '400ms' }} />

          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 110px 100px 120px',
              padding: '0 0 10px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              fontFamily: 'var(--pw-font-body)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--pw-muted)',
            }}
          >
            <span>Date</span>
            <span>Type</span>
            <span style={{ textAlign: 'right' }}>Invitations</span>
            <span style={{ textAlign: 'right' }}>Min CRS</span>
            <span style={{ textAlign: 'right' }}>Status</span>
          </div>

          {/* Table rows */}
          {DRAWS_DATA.map((draw, i) => {
            const qualifies = crsLow !== null && draw.cutoff <= crsLow;
            return (
              <div
                key={draw.date}
                className="pw-entry"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 110px 100px 120px',
                  padding: '14px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  alignItems: 'center',
                  animationDelay: `${440 + i * 40}ms`,
                  transition: 'background 120ms',
                  cursor: 'default',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '13px',
                    color: 'var(--pw-muted)',
                  }}
                >
                  {formatDate(draw.date)}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--pw-ink)',
                  }}
                >
                  {draw.type}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontSize: '18px',
                    fontWeight: 400,
                    color: 'var(--pw-ink)',
                    textAlign: 'right',
                  }}
                >
                  {draw.invitations.toLocaleString()}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontSize: '18px',
                    fontWeight: 400,
                    color: 'var(--pw-ink)',
                    textAlign: 'right',
                  }}
                >
                  {draw.cutoff}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '12px',
                    color: hasScore
                      ? qualifies ? 'var(--pw-accent)' : 'var(--pw-muted)'
                      : 'var(--pw-muted)',
                    textAlign: 'right',
                  }}
                >
                  {hasScore
                    ? qualifies ? 'Would qualify' : 'Below cut-off'
                    : '—'}
                </span>
              </div>
            );
          })}

          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '11px',
              color: 'var(--pw-muted)',
              fontStyle: 'italic',
              marginTop: '12px',
            }}
          >
            Source: IRCC Express Entry — canada.ca. Figures may vary from official IRCC records.
          </p>
        </div>

        {/* ── Disclaimer ── */}
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '12px',
            color: 'var(--pw-muted)',
            maxWidth: '560px',
          }}
        >
          Past cut-off scores are not a guarantee of future thresholds.
          Draw types and invitation counts vary by IRCC priorities and pool composition.
        </p>

      </main>
    </SwissPageShell>
  );
}
