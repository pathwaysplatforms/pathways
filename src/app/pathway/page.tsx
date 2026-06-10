import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/modules/auth/service';
import type { PathwayInput } from '@/lib/pathway-input';
import { SwissPageShell } from '@/components/layout/SwissPageShell';

const TIMELINE_STEPS = ['Profile', 'Pathway', 'Docs', 'Submit', 'Decision'];

const RECOMMENDED_PATHWAYS = [
  {
    name: 'Express Entry — Federal Skilled Worker',
    description:
      'For skilled workers with foreign work experience in a NOC TEER 0, 1, 2, or 3 occupation.',
    eligibility: 'Likely eligible' as const,
  },
  {
    name: 'Express Entry — Canadian Experience Class',
    description:
      'For temporary residents with at least one year of eligible Canadian work experience.',
    eligibility: 'Check requirements' as const,
  },
  {
    name: 'Ontario Immigrant Nominee Program (OINP)',
    description:
      "Provincial pathway for workers with skills aligned to Ontario's labour market needs.",
    eligibility: 'Check requirements' as const,
  },
];

/** My Pathway page — personalised immigration roadmap. */
export default async function PathwayPage() {
  const profile = await getProfile();
  if (!profile) redirect('/auth/login');

  const pathwayInput = profile.pathway_input_json as PathwayInput | null;
  const hasPathway =
    pathwayInput !== null && (pathwayInput.crs_estimate.range_low > 0 || pathwayInput.crs_estimate.range_high > 0);

  const originCity = pathwayInput?.personal.current_country ?? 'Your country';
  const destinationCity = pathwayInput?.preferences.destination_province ?? 'Canada';

  return (
    <SwissPageShell>
      <main className="max-w-6xl mx-auto px-6 py-20">
        {/* ── Header ── */}
        <div className="mb-16">
          <p className="pw-eyebrow pw-entry">MY PATHWAY</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry pw-entry-delay-1" />
          <h1
            className="pw-entry pw-entry-delay-2 mb-3 leading-tight"
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              color: 'var(--pw-ink)',
            }}
          >
            Your immigration pathway
          </h1>
          <p
            className="pw-entry pw-entry-delay-3 text-sm"
            style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--pw-muted)' }}
          >
            A personalised roadmap built from your profile.
          </p>
        </div>

        {hasPathway && pathwayInput ? (
          <>
            {/* ── Active pathway card (dark) ── */}
            <div
              className="rounded-xl p-8 mb-12 pw-entry pw-entry-delay-4"
              style={{ background: '#0D0D0D', color: '#fff' }}
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-10">
                <p
                  className="leading-snug"
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontStyle: 'italic',
                    fontSize: '28px',
                  }}
                >
                  {originCity}
                  <span className="mx-3" style={{ color: 'var(--pw-accent)' }}>
                    →
                  </span>
                  {destinationCity}
                </p>
                <div className="text-right flex-shrink-0">
                  <p
                    className="mb-1 tracking-widest uppercase"
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: '10px',
                      fontWeight: 500,
                      opacity: 0.5,
                    }}
                  >
                    CRS estimate
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-display)',
                      fontSize: '2.5rem',
                      fontWeight: 400,
                      lineHeight: 1,
                    }}
                  >
                    {pathwayInput.crs_estimate.range_low}&nbsp;–&nbsp;
                    {pathwayInput.crs_estimate.range_high}
                  </p>
                </div>
              </div>

              {/* 5-dot timeline */}
              <div className="flex items-center">
                {TIMELINE_STEPS.map((step, i) => {
                  const isComplete = i < 2;
                  const isCurrent = i === 2;
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{
                            background: isComplete ? '#fff' : 'transparent',
                            borderColor:
                              isComplete || isCurrent ? '#fff' : 'rgba(255,255,255,0.2)',
                            opacity: !isComplete && !isCurrent ? 0.3 : 1,
                            boxShadow: isCurrent
                              ? '0 0 0 4px rgba(255,255,255,0.12)'
                              : undefined,
                          }}
                        />
                        <span
                          className="hidden sm:block text-[10px] tracking-wide whitespace-nowrap"
                          style={{
                            fontFamily: 'var(--pw-font-body)',
                            opacity: isComplete || isCurrent ? 0.8 : 0.3,
                          }}
                        >
                          {step}
                        </span>
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div
                          className="flex-1 h-px mx-2"
                          style={{ background: 'rgba(255,255,255,0.1)' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Recommended pathways ── */}
            <div className="mb-16">
              <p className="pw-eyebrow pw-entry pw-entry-delay-5">RECOMMENDED PATHWAYS</p>
              <div className="pw-rule-line mt-3 mb-8 pw-entry pw-entry-delay-5" />
              <div className="flex flex-col gap-4">
                {RECOMMENDED_PATHWAYS.map((pathway, i) => (
                  <div
                    key={pathway.name}
                    className="pw-card pw-entry flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    style={{ animationDelay: `${330 + i * 55}ms` }}
                  >
                    <div className="flex-1">
                      <p
                        className="mb-1"
                        style={{
                          fontFamily: 'var(--pw-font-display)',
                          fontSize: '20px',
                          fontWeight: 400,
                          color: 'var(--pw-ink)',
                        }}
                      >
                        {pathway.name}
                      </p>
                      <p
                        className="text-sm"
                        style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--pw-muted)' }}
                      >
                        {pathway.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <span
                        className="px-3 py-1 text-xs rounded-full"
                        style={{
                          fontFamily: 'var(--pw-font-body)',
                          border: '1px solid',
                          borderColor:
                            pathway.eligibility === 'Likely eligible'
                              ? 'var(--pw-ink)'
                              : 'rgba(0,0,0,0.2)',
                          color:
                            pathway.eligibility === 'Likely eligible'
                              ? 'var(--pw-ink)'
                              : 'var(--pw-muted)',
                        }}
                      >
                        {pathway.eligibility}
                      </span>
                      <span className="text-pw-muted hover:text-pw-accent transition-colors duration-150">
                        →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* ── Empty state ── */
          <div className="pw-card text-center py-16 mb-16 pw-entry pw-entry-delay-4">
            <p
              className="mb-4"
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontStyle: 'italic',
                fontSize: '1.75rem',
                color: 'var(--pw-ink)',
              }}
            >
              Your roadmap is waiting.
            </p>
            <p
              className="text-sm mb-8"
              style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--pw-muted)' }}
            >
              Complete your profile to unlock your personalised pathway.
            </p>
            <Link href="/onboarding" className="pw-btn-primary">
              Start onboarding
            </Link>
          </div>
        )}

        {/* ── Disclaimer ── */}
        <p
          className="text-center"
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '11px',
            color: 'var(--pw-muted)',
            fontStyle: 'italic',
          }}
        >
          General information only, not legal advice. Consult a licensed immigration consultant.
        </p>
      </main>
    </SwissPageShell>
  );
}
