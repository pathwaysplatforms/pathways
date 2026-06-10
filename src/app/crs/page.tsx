import { redirect } from 'next/navigation';
import { getProfile } from '@/modules/auth/service';
import type { PathwayInput } from '@/lib/pathway-input';
import { SwissPageShell } from '@/components/layout/SwissPageShell';
import { CrsDotsCanvas } from '@/components/crs/CrsDotsCanvas';

const CRS_MAX = 1200;
const RECENT_CUTOFF = 480;

const SCORE_FACTORS = [
  {
    name: 'Core Human Capital',
    max: 460,
    description: 'Age, education, language proficiency, and Canadian work experience.',
  },
  {
    name: 'Spouse / Partner',
    max: 40,
    description: "Partner's language scores and Canadian work experience.",
  },
  {
    name: 'Skill Transferability',
    max: 100,
    description: 'Combinations of education level with language or work experience.',
  },
  {
    name: 'Additional Points',
    max: 600,
    description: 'Provincial nomination, arranged employment, Canadian education, French.',
  },
] as const;

/** CRS score explainer page with dot density canvas. */
export default async function CrsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/auth/login');

  const pathwayInput = profile.pathway_input_json as PathwayInput | null;
  const crsLow = pathwayInput?.crs_estimate.range_low ?? null;
  const crsHigh = pathwayInput?.crs_estimate.range_high ?? null;
  const hasScore = crsLow !== null && crsHigh !== null && (crsLow > 0 || crsHigh > 0);

  const today = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SwissPageShell>
      <main className="max-w-5xl mx-auto px-6 py-20 relative z-10">

        {/* ── Header ── */}
        <div className="mb-16">
          <p className="pw-eyebrow pw-entry">CRS SCORE</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry pw-entry-delay-1" />
          <h1
            className="pw-entry pw-entry-delay-2 leading-tight mb-3"
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontWeight: 400,
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              color: 'var(--pw-ink)',
              lineHeight: 1.05,
            }}
          >
            Comprehensive<br />Ranking System
          </h1>
          <p
            className="pw-entry pw-entry-delay-3"
            style={{
              fontFamily: 'var(--pw-font-body)',
              color: 'var(--pw-muted)',
              fontSize: '15px',
              marginTop: '12px',
              maxWidth: '480px',
            }}
          >
            How IRCC ranks candidates in the Express Entry pool.
            Order is determined entirely by score — no exceptions.
          </p>
        </div>

        {/* ── Score card (dark) ── */}
        <div
          className="pw-entry pw-entry-delay-4 mb-16"
          style={{
            background: '#0D0D0D',
            borderRadius: 0,
            padding: '40px 48px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '16px',
            }}
          >
            YOUR ESTIMATED SCORE
          </p>

          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: '88px',
              fontWeight: 400,
              color: '#FFFFFF',
              lineHeight: 1,
              marginBottom: '8px',
            }}
          >
            {hasScore && crsLow !== null && crsHigh !== null
              ? `${crsLow} – ${crsHigh}`
              : <span style={{ opacity: 0.3 }}>—</span>}
          </p>

          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '32px',
            }}
          >
            Based on your voice profile · {today}
          </p>

          {/* Dot density canvas */}
          <div style={{ marginBottom: '8px' }}>
            {hasScore && crsLow !== null && crsHigh !== null ? (
              <CrsDotsCanvas
                scoreLow={crsLow}
                scoreHigh={crsHigh}
                cutoff={RECENT_CUTOFF}
                maxScore={CRS_MAX}
              />
            ) : (
              <CrsDotsCanvas
                scoreLow={0}
                scoreHigh={0}
                cutoff={RECENT_CUTOFF}
                maxScore={CRS_MAX}
              />
            )}
          </div>

          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'right',
              marginTop: '4px',
            }}
          >
            Score range 0 – {CRS_MAX}
          </p>
        </div>

        {/* ── Score breakdown ── */}
        <div className="mb-16 pw-entry pw-entry-delay-5">
          <p className="pw-eyebrow">HOW YOUR SCORE IS BUILT</p>
          <div className="pw-rule-line mt-3 mb-8" />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {SCORE_FACTORS.map((factor, i) => (
              <div
                key={factor.name}
                className="pw-entry"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '20px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  animationDelay: `${330 + i * 50}ms`,
                }}
              >
                <div style={{ maxWidth: '60%' }}>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-display)',
                      fontSize: '18px',
                      fontWeight: 400,
                      color: 'var(--pw-ink)',
                    }}
                  >
                    {factor.name}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '13px',
                      color: 'var(--pw-muted)',
                      marginTop: '4px',
                    }}
                  >
                    {factor.description}
                  </p>
                </div>
                <p
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontSize: '32px',
                    fontWeight: 400,
                    color: 'var(--pw-muted)',
                    flexShrink: 0,
                  }}
                >
                  {factor.max}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── High impact ── */}
        <div className="mb-16 pw-entry" style={{ animationDelay: '550ms' }}>
          <p className="pw-eyebrow">WHAT MOVES YOUR SCORE MOST</p>
          <div className="pw-rule-line mt-3 mb-8" />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0',
            }}
          >
            {/* Language */}
            <div
              className="pw-entry"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '24px 24px 24px 0', animationDelay: '605ms' }}
            >
              <p
                style={{
                  fontFamily: 'var(--pw-font-display)',
                  fontStyle: 'italic',
                  fontSize: '22px',
                  fontWeight: 400,
                  color: 'var(--pw-ink)',
                }}
              >
                Every CLB point counts.
              </p>
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '13px',
                  color: 'var(--pw-muted)',
                  marginTop: '8px',
                }}
              >
                Moving from CLB 9 to CLB 10 in all abilities can add 32+ points.
              </p>
            </div>

            {/* Canadian experience */}
            <div
              className="pw-entry"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '24px', animationDelay: '655ms' }}
            >
              <p
                style={{
                  fontFamily: 'var(--pw-font-display)',
                  fontStyle: 'italic',
                  fontSize: '22px',
                  fontWeight: 400,
                  color: 'var(--pw-ink)',
                }}
              >
                One year changes everything.
              </p>
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '13px',
                  color: 'var(--pw-muted)',
                  marginTop: '8px',
                }}
              >
                A single year of skilled work in Canada adds up to 80 core points.
              </p>
            </div>

            {/* Provincial nomination */}
            <div
              className="pw-entry"
              style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '24px 0 24px 24px', animationDelay: '705ms' }}
            >
              <p
                style={{
                  fontFamily: 'var(--pw-font-display)',
                  fontStyle: 'italic',
                  fontSize: '22px',
                  fontWeight: 400,
                  color: 'var(--pw-ink)',
                }}
              >
                <span style={{ color: 'var(--pw-accent)' }}>600 points.</span> Near-certain.
              </p>
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '13px',
                  color: 'var(--pw-muted)',
                  marginTop: '8px',
                }}
              >
                A provincial nomination adds 600 points — virtually guaranteeing an ITA.
              </p>
            </div>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '12px',
            color: 'var(--pw-muted)',
            maxWidth: '560px',
          }}
        >
          <p>
            CRS scores are calculated by IRCC using their official formula.
            This estimate is approximate and does not account for all factors.
            Use the official IRCC CRS tool for your exact score.
          </p>
          <p style={{ marginTop: '8px' }}>
            <a
              href="https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: '13px',
                color: 'var(--pw-ink)',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
              }}
            >
              → Open official IRCC CRS tool
            </a>
          </p>
        </div>

      </main>
    </SwissPageShell>
  );
}
