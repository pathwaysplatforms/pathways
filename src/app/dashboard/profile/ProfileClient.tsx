'use client';

import { useState, useTransition } from 'react';
import type { ProfileTabData } from '@/modules/profile/types';
import { updateProfileFields, recalculateCrsEstimate } from '@/app/actions/profile';
import { resetOnboarding } from '@/app/actions/onboarding';
import type { CrsEstimate } from '@/lib/crs-estimate';
import type { SectionSavePayload } from './sections/shared';
import { IdentitySection } from './sections/IdentitySection';
import { OccupationSection } from './sections/OccupationSection';
import { EducationSection } from './sections/EducationSection';
import { LanguageSection } from './sections/LanguageSection';
import { WorkHistorySection } from './sections/WorkHistorySection';
import { ImmigrationIntentSection } from './sections/ImmigrationIntentSection';
import { SpouseSection } from './sections/SpouseSection';
import { CrsBonusSection } from './sections/CrsBonusSection';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractStoredEstimate(json: Record<string, unknown> | null): CrsEstimate | null {
  if (!json) return null;
  const est = json['crs_estimate'];
  if (est && typeof est === 'object' && 'score' in est && 'breakdown' in est) {
    return est as CrsEstimate;
  }
  return null;
}

function calcCompleteness(d: ProfileTabData): { pct: number; missing: string[] } {
  const checks: { label: string; value: unknown }[] = [
    { label: 'Nationality', value: d.nationality },
    { label: 'Education', value: d.educationLevel },
    { label: 'Language scores', value: d.clbListening },
    { label: 'Work experience', value: d.yearsExperience },
    { label: 'ECA', value: d.ecaObtained },
  ];
  const missing = checks
    .filter((c) => c.value === null || c.value === undefined)
    .map((c) => c.label);
  const present = checks.length - missing.length;
  return {
    pct: d.profileCompletenessPct ?? Math.round((present / checks.length) * 100),
    missing,
  };
}

function formatLastUpdated(isoString: string | null): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── CRS Hero ─────────────────────────────────────────────────────────────────

function CrsHero({
  estimate,
  pathwayName,
  lastRecalcAt,
  isRecalculating,
  onRecalculate,
}: {
  estimate: CrsEstimate | null;
  pathwayName: string | null;
  lastRecalcAt: string | null;
  isRecalculating: boolean;
  onRecalculate: () => void;
}) {
  return (
    <div className="pw-card pw-entry" style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="pw-eyebrow" style={{ marginBottom: 12 }}>Estimated CRS Score</p>

          {estimate ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: 'var(--pw-font-display)',
                    fontSize: '3.5rem',
                    color: '#0D0D0D',
                    lineHeight: 1,
                  }}
                >
                  {estimate.score}
                </span>
                {pathwayName && (
                  <span
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 14,
                      color: '#6B6B6B',
                    }}
                  >
                    {pathwayName}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9B9B9B' }}>
                Range {estimate.low}–{estimate.high}
                {estimate.margin ? ` (±${estimate.margin} pts)` : ''}
                {lastRecalcAt ? ` · Updated ${formatLastUpdated(lastRecalcAt)}` : ''}
              </p>
              {estimate.belowCutoff && estimate.cutoffReason && (
                <p
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 12,
                    color: 'var(--pw-error)',
                    marginTop: 10,
                    padding: '6px 10px',
                    border: '1px solid rgba(185,28,28,0.2)',
                    background: 'rgba(185,28,28,0.04)',
                    display: 'inline-block',
                  }}
                >
                  {estimate.cutoffReason}
                </p>
              )}
            </>
          ) : (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#9B9B9B', marginTop: 4 }}>
              No estimate yet — complete your profile and save a section to recalculate.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onRecalculate}
          disabled={isRecalculating}
          onMouseEnter={(e) => {
            if (!isRecalculating) {
              (e.currentTarget as HTMLButtonElement).style.background = '#0D0D0D';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRecalculating) {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#0D0D0D';
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '10px 20px',
            fontFamily: 'var(--pw-font-ui)',
            fontSize: 14,
            fontWeight: 500,
            color: isRecalculating ? '#9B9B9B' : '#0D0D0D',
            background: 'transparent',
            border: '1px solid',
            borderColor: isRecalculating ? 'rgba(0,0,0,0.15)' : '#0D0D0D',
            borderRadius: 8,
            cursor: isRecalculating ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          {isRecalculating ? 'Calculating…' : 'Recalculate CRS'}
        </button>
      </div>

      {/* Breakdown grid */}
      {estimate && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: 8,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid rgba(0,0,0,0.07)',
          }}
        >
          {(
            [
              ['Age', estimate.breakdown.age],
              ['Education', estimate.breakdown.education],
              ['Language', estimate.breakdown.language],
              ['Experience', estimate.breakdown.experience],
              ['Transferability', estimate.breakdown.transferability],
              ['Additional', estimate.breakdown.additional],
            ] as [string, number][]
          ).map(([cat, pts]) => (
            <div
              key={cat}
              style={{
                textAlign: 'center',
                padding: '10px 8px',
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.125rem', color: '#0D0D0D' }}>
                {pts}
              </p>
              <p
                style={{
                  fontFamily: 'var(--pw-font-body)',
                  fontSize: 10,
                  color: '#9B9B9B',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                {cat}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Completeness bar ─────────────────────────────────────────────────────────

function CompletenessBar({ pct, missing }: { pct: number; missing: string[] }) {
  return (
    <div className="pw-entry" style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p className="pw-eyebrow">Profile Completeness</p>
        <span style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.125rem', color: '#0D0D0D' }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 2, background: 'rgba(0,0,0,0.07)', borderRadius: 1, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            background: '#0D0D0D',
            borderRadius: 1,
            width: `${pct}%`,
            transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
      {missing.length > 0 && (
        <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B', marginTop: 6 }}>
          Missing: {missing.join(', ')}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileClientProps {
  data: ProfileTabData;
}

/** Profile tab — sectioned cards with per-section inline edit and CRS hero. */
export function ProfileClient({ data: initialData }: ProfileClientProps) {
  const [data, setData] = useState<ProfileTabData>(initialData);
  const [isRecalculating, startRecalcTransition] = useTransition();
  const [crsEstimate, setCrsEstimate] = useState<CrsEstimate | null>(
    () => extractStoredEstimate(initialData.pathwayInputJson)
  );
  const [lastRecalcAt, setLastRecalcAt] = useState<string | null>(
    () => (initialData.pathwayInputJson?.['crs_recalculated_at'] as string | null) ?? null
  );

  async function handleSectionSave({ fields, recalculate }: SectionSavePayload) {
    await updateProfileFields(fields);
    setData((prev) => {
      const next = { ...prev };
      const keyMap: Record<string, keyof ProfileTabData> = {
        full_name: 'fullName',
        nationality: 'nationality',
        current_country: 'currentCountry',
        occupation: 'occupation',
        years_experience: 'yearsExperience',
        noc_teer_category: 'nocTeerCategory',
        noc_code: 'nocCode',
        has_canadian_experience: 'hasCanadianExperience',
        education_level: 'educationLevel',
        degree_field: 'degreeField',
        eca_obtained: 'ecaObtained',
        clb_listening: 'clbListening',
        clb_reading: 'clbReading',
        clb_speaking: 'clbSpeaking',
        clb_writing: 'clbWriting',
        intended_province: 'intendedProvince',
        has_family_in_canada: 'hasFamilyInCanada',
        canadian_work_years: 'canadianWorkYears',
        foreign_work_years: 'foreignWorkYears',
        canadian_work_recent: 'canadianWorkRecent',
        foreign_work_recent: 'foreignWorkRecent',
        spouse_coming_to_canada: 'spouseComingToCanada',
        spouse_education_level: 'spouseEducationLevel',
        spouse_clb_listening: 'spouseClbListening',
        spouse_clb_reading: 'spouseClbReading',
        spouse_clb_speaking: 'spouseClbSpeaking',
        spouse_clb_writing: 'spouseClbWriting',
        spouse_canadian_work_years: 'spouseCanadianWorkYears',
        has_provincial_nomination: 'hasProvincialNomination',
        has_canadian_job_offer: 'hasCanadianJobOffer',
        has_sibling_in_canada: 'hasSiblingInCanada',
      };
      for (const [snake, camel] of Object.entries(keyMap)) {
        if (snake in fields) {
          (next as Record<string, unknown>)[camel] = (fields as Record<string, unknown>)[snake];
        }
      }
      return next;
    });

    if (recalculate) {
      startRecalcTransition(async () => {
        const result = await recalculateCrsEstimate();
        if (result) {
          const now = new Date().toISOString();
          setCrsEstimate(result);
          setLastRecalcAt(now);
          setData((prev) => ({
            ...prev,
            pathwayInputJson: {
              ...(prev.pathwayInputJson ?? {}),
              crs_estimate: result,
              crs_recalculated_at: now,
            },
          }));
        }
      });
    }
  }

  function handleManualRecalculate() {
    startRecalcTransition(async () => {
      const result = await recalculateCrsEstimate();
      if (result) {
        const now = new Date().toISOString();
        setCrsEstimate(result);
        setLastRecalcAt(now);
        setData((prev) => ({
          ...prev,
          pathwayInputJson: {
            ...(prev.pathwayInputJson ?? {}),
            crs_estimate: result,
            crs_recalculated_at: now,
          },
        }));
      }
    });
  }

  const { pct, missing } = calcCompleteness(data);

  return (
    <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Page header */}
        <div className="pw-entry" style={{ marginBottom: 28 }}>
          <p className="pw-eyebrow" style={{ marginBottom: 6 }}>Profile</p>
          <h1
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: '1.875rem',
              color: '#0D0D0D',
              lineHeight: 1.2,
            }}
          >
            Your immigration profile
          </h1>
        </div>

        <CrsHero
          estimate={crsEstimate}
          pathwayName={data.pathwayName}
          lastRecalcAt={lastRecalcAt}
          isRecalculating={isRecalculating}
          onRecalculate={handleManualRecalculate}
        />

        <CompletenessBar pct={pct} missing={missing} />

        {/* Section grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 20,
            marginBottom: 40,
          }}
        >
          <IdentitySection data={data} onSave={handleSectionSave} />
          <OccupationSection data={data} onSave={handleSectionSave} />
          <EducationSection data={data} onSave={handleSectionSave} />
          <LanguageSection data={data} onSave={handleSectionSave} />
          <WorkHistorySection data={data} onSave={handleSectionSave} />
          <ImmigrationIntentSection data={data} onSave={handleSectionSave} />
          <SpouseSection data={data} onSave={handleSectionSave} />
          <CrsBonusSection data={data} onSave={handleSectionSave} />
        </div>

        {/* Redo onboarding */}
        <div
          className="pw-entry"
          style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 32 }}
        >
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: '1rem',
              color: '#0D0D0D',
              marginBottom: 6,
            }}
          >
            Want to start fresh?
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 13,
              color: '#9B9B9B',
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            Redoing your onboarding will replace your current profile with a new voice session.
          </p>
          <form action={resetOnboarding}>
            <button
              type="submit"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(185,28,28,0.05)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pw-error)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(185,28,28,0.35)';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 20px',
                fontFamily: 'var(--pw-font-ui)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--pw-error)',
                background: 'transparent',
                border: '1px solid rgba(185,28,28,0.35)',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
              }}
            >
              Redo onboarding
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
