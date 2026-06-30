import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/modules/auth/service';
import type { PathwayInput } from '@/lib/pathway-input';

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

type EffortLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface ImprovementLever {
  points: number;
  name: string;
  description: string;
  effort: EffortLevel;
  effortDetail: string;
}

const IMPROVEMENT_LEVERS: ImprovementLever[] = [
  {
    points: 600,
    name: 'Provincial nomination',
    description: 'A nomination adds 600 CRS points — near-certain ITA at next draw.',
    effort: 'HIGH',
    effortDetail: 'months to years',
  },
  {
    points: 50,
    name: 'Improve language scores to CLB 10',
    description: 'Moving all four IELTS abilities from CLB 9 to 10 adds 32–50 points.',
    effort: 'MEDIUM',
    effortDetail: 'weeks of study',
  },
  {
    points: 25,
    name: 'Add French language scores',
    description: 'A TEF Canada result at B2+ adds 15–25 bonus points.',
    effort: 'LOW',
    effortDetail: 'achievable in 1–2 months',
  },
  {
    points: 80,
    name: 'Gain one year of Canadian work experience',
    description: 'One year of skilled work in Canada adds up to 80 core points.',
    effort: 'HIGH',
    effortDetail: 'requires work permit first',
  },
];

const EFFORT_COLORS: Record<EffortLevel, string> = {
  HIGH: '#E24B4A',
  MEDIUM: '#EF9F27',
  LOW: '#639922',
};

/** CRS score explainer page — typographic hero with improvement levers and pool grid. */
export default async function CrsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/auth/login');

  const pathwayInput = profile.pathway_input_json as PathwayInput | null;
  const crsLow = pathwayInput?.crs_estimate.range_low ?? null;
  const crsHigh = pathwayInput?.crs_estimate.range_high ?? null;
  const hasScore = crsLow !== null && crsHigh !== null && (crsLow > 0 || crsHigh > 0);

  const scoreLow = hasScore && crsLow !== null ? crsLow : 0;
  const scoreHigh = hasScore && crsHigh !== null ? crsHigh : 0;

  const today = new Date().toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const scoreLowPct = (scoreLow / CRS_MAX) * 100;
  const scoreHighPct = (scoreHigh / CRS_MAX) * 100;
  const cutoffPct = (RECENT_CUTOFF / CRS_MAX) * 100;

  // Proportional factor estimates from crsLow — rough approximation only
  const factorEstimates: number[] = [
    Math.round((scoreLow / CRS_MAX) * 460),
    0,
    Math.round((scoreLow / CRS_MAX) * 100),
    0,
  ];

  const poolLowPct = scoreLow / CRS_MAX;
  const poolHighPct = scoreHigh / CRS_MAX;
  const poolCutoffPct = RECENT_CUTOFF / CRS_MAX;

  return (
    <div className="flex-1 overflow-y-auto relative z-10">
      <div className="max-w-5xl mx-auto px-6 pb-20 pt-8">

        {/* Back navigation */}
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/dashboard/profile"
            className="text-pw-muted hover:text-pw-ink transition-colors"
            style={{ fontFamily: 'var(--pw-font-body)', fontSize: '13px', textDecoration: 'none' }}
          >
            ← Back to Profile
          </Link>
        </div>

        {/* ── Section 1: Header ── */}
        <div className="mb-16">
          <p className="pw-eyebrow pw-entry">CRS SCORE</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry pw-entry-delay-1" />
          <h1
            className="pw-entry pw-entry-delay-2"
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontWeight: 700,
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              color: 'var(--pw-ink)',
              lineHeight: 1.05,
              marginBottom: '12px',
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
              maxWidth: '480px',
            }}
          >
            How IRCC ranks candidates in the Express Entry pool.
            Order is determined entirely by score — no exceptions.
          </p>
        </div>

        {/* ── Section 2: Score hero ── */}
        <div className="mb-16 pw-entry pw-entry-delay-4">
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '10px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--pw-muted)',
              marginBottom: '8px',
            }}
          >
            YOUR ESTIMATED SCORE
          </p>

          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: 'clamp(4.25rem, 10vw, 6.75rem)',
              fontWeight: 700,
              color: 'var(--pw-ink)',
              lineHeight: 1,
              marginBottom: '6px',
            }}
          >
            {hasScore
              ? `${crsLow} – ${crsHigh}`
              : <span style={{ opacity: 0.2 }}>—</span>}
          </p>

          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '12px',
              fontStyle: 'italic',
              color: 'var(--pw-muted)',
              marginBottom: '4px',
            }}
          >
            Low confidence estimate · Complete your profile to narrow your range
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '13px',
              color: 'var(--pw-muted)',
              marginBottom: '24px',
            }}
          >
            Based on your voice profile · {today}
          </p>

          {/* Score track */}
          <div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '3px',
                background: 'rgba(0,0,0,0.08)',
                borderRadius: '2px',
              }}
            >
              {/* Score range fill */}
              {hasScore && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${scoreLowPct}%`,
                    width: `${scoreHighPct - scoreLowPct}%`,
                    height: '3px',
                    background: '#1A56DB',
                  }}
                />
              )}

              {/* Cut-off tick */}
              <div
                style={{
                  position: 'absolute',
                  left: `${cutoffPct}%`,
                  width: '1px',
                  height: '16px',
                  top: '-6px',
                  background: 'rgba(0,0,0,0.2)',
                }}
              />

              {/* Score dot */}
              {hasScore && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${scoreLowPct}%`,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#1A56DB',
                    top: '-2.5px',
                    transform: 'translateX(-50%)',
                  }}
                />
              )}
            </div>

            {/* Track labels */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '11px',
                  color: 'var(--pw-muted)',
                }}
              >
                0
              </span>

              <span
                style={{
                  position: 'absolute',
                  left: `${cutoffPct}%`,
                  transform: 'translateX(-50%)',
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '11px',
                  color: 'var(--pw-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                Cut-off ~480
              </span>

              {hasScore && (
                <span
                  style={{
                    position: 'absolute',
                    left: `${scoreLowPct}%`,
                    transform: 'translateX(-50%)',
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '11px',
                    color: '#1A56DB',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Your range
                </span>
              )}

              <span
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: '11px',
                  color: 'var(--pw-muted)',
                }}
              >
                1,200
              </span>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-neutral-100 my-16" />

        {/* ── Section 3: Factor breakdown ── */}
        <div className="mb-16 pw-entry pw-entry-delay-5">
          <p className="pw-eyebrow">HOW YOUR SCORE IS BUILT</p>
          <div className="pw-rule-line mt-3 mb-8" />

          <div>
            {SCORE_FACTORS.map((factor, i) => {
              const yourPts = factorEstimates[i] ?? 0;
              const fillPct = Math.min(100, (yourPts / factor.max) * 100);
              return (
                <div
                  key={factor.name}
                  className="pw-entry"
                  style={{
                    padding: '20px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    animationDelay: `${330 + i * 50}ms`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--pw-ink)',
                      }}
                    >
                      {factor.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        fontSize: '13px',
                        color: 'var(--pw-muted)',
                        flexShrink: 0,
                        marginLeft: '16px',
                      }}
                    >
                      {hasScore ? yourPts : '—'} / {factor.max}
                    </span>
                  </div>

                  {/* Bar */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '3px',
                      background: 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        width: `${hasScore ? fillPct : 0}%`,
                        height: '3px',
                        background: 'var(--pw-ink)',
                      }}
                    />
                    {hasScore && fillPct > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${fillPct}%`,
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--pw-ink)',
                          top: '-2.5px',
                          transform: 'translateX(-50%)',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: '11px',
              fontStyle: 'italic',
              color: 'var(--pw-muted)',
              marginTop: '12px',
            }}
          >
            Factor breakdown is estimated. Actual scores may vary.
          </p>
        </div>

        {/* ── Section 4: Improvement levers ── */}
        <div className="mb-16 pw-entry" style={{ animationDelay: '450ms' }}>
          <p className="pw-eyebrow">HOW TO IMPROVE YOUR SCORE</p>
          <div className="pw-rule-line mt-3 mb-8" />

          <div>
            {IMPROVEMENT_LEVERS.map((lever, i) => (
              <div
                key={lever.name}
                className="pw-entry"
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '20px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  animationDelay: `${500 + i * 60}ms`,
                }}
              >
                {/* Left column — point gain */}
                <div
                  style={{
                    width: '72px',
                    flexShrink: 0,
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-display)',
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#1A56DB',
                      lineHeight: 1,
                    }}
                  >
                    +{lever.points}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '10px',
                      color: 'var(--pw-muted)',
                      marginTop: '2px',
                    }}
                  >
                    pts
                  </p>
                </div>

                {/* Right column — lever detail */}
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--pw-ink)',
                    }}
                  >
                    {lever.name}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '13px',
                      color: 'var(--pw-muted)',
                      lineHeight: 1.6,
                      marginTop: '3px',
                    }}
                  >
                    {lever.description}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '6px',
                    }}
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: EFFORT_COLORS[lever.effort],
                        flexShrink: 0,
                      }}
                    />
                    <p
                      style={{
                        fontFamily: 'var(--pw-font-body)',
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--pw-muted)',
                      }}
                    >
                      {lever.effort} EFFORT · {lever.effortDetail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 5: Pool position dot grid ── */}
        <div className="mb-16 pw-entry" style={{ animationDelay: '650ms' }}>
          <p className="pw-eyebrow">YOUR POSITION IN THE POOL</p>
          <div className="pw-rule-line mt-3 mb-8" />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(40, 10px)',
              gap: '4px',
            }}
          >
            {Array.from({ length: 400 }, (_, idx) => {
              const pct = idx / 400;
              let bg: string;
              if (hasScore && pct >= poolLowPct && pct <= poolHighPct) {
                bg = '#1A56DB';
              } else if (pct >= poolCutoffPct) {
                bg = 'rgba(13,13,13,0.7)';
              } else {
                bg = 'rgba(0,0,0,0.1)';
              }
              return (
                <div
                  key={idx}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: bg,
                  }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              marginTop: '12px',
              flexWrap: 'wrap',
            }}
          >
            {([
              { color: '#1A56DB', label: 'Your score range' },
              { color: 'rgba(13,13,13,0.7)', label: 'Above recent cut-off' },
              { color: 'rgba(0,0,0,0.1)', label: 'Below cut-off' },
            ] as const).map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: '12px',
                    color: 'var(--pw-muted)',
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 6: Disclaimer ── */}
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

      </div>
    </div>
  );
}
