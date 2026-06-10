import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/modules/auth/service';
import { getProfileTabData, buildAvatarInitials } from '@/modules/profile/service';
import { createRequestLogger } from '@/lib/logger';
import type { PathwayInput } from '@/lib/pathway-input';
import { SwissPageShell } from '@/components/layout/SwissPageShell';

const MISSING = '—';

function val(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return MISSING;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="pw-eyebrow mb-1"
        style={{ fontSize: '10px' }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--pw-ink)',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <>
      <p className="pw-eyebrow mt-12 mb-3">{label}</p>
      <div className="pw-rule-line mb-8" />
    </>
  );
}

function ClbBar({ score }: { score: number | null }) {
  const level = score ?? 0;
  const max = 12;
  const filled = Math.min(level, max);
  return (
    <div className="flex gap-1 mt-2" aria-label={`CLB ${level}`}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: i < filled ? 'var(--pw-ink)' : 'var(--pw-rule)',
          }}
        />
      ))}
    </div>
  );
}

/** User profile page — read-only view of immigration profile data. */
export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect('/auth/login');

  const logger = createRequestLogger(`profile-page-${profile.auth_user_id}`);
  const tabData = await getProfileTabData(profile.auth_user_id, logger);
  const pathwayInput = profile.pathway_input_json as PathwayInput | null;

  const initials = buildAvatarInitials(tabData.fullName);
  const crsLow = pathwayInput?.crs_estimate.range_low ?? null;
  const crsHigh = pathwayInput?.crs_estimate.range_high ?? null;

  const avgClb =
    tabData.clbListening !== null &&
    tabData.clbReading !== null &&
    tabData.clbSpeaking !== null &&
    tabData.clbWriting !== null
      ? Math.round(
          (tabData.clbListening + tabData.clbReading + tabData.clbSpeaking + tabData.clbWriting) /
            4
        )
      : null;

  return (
    <SwissPageShell>
      <main className="max-w-4xl mx-auto px-6 py-20">
        {/* ── Header ── */}
        <div className="mb-12">
          <p className="pw-eyebrow pw-entry">PROFILE</p>
          <div className="pw-rule-line mt-3 mb-6 pw-entry pw-entry-delay-1" />
          <div className="flex items-center gap-5 pw-entry pw-entry-delay-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--pw-ink)' }}
              aria-hidden="true"
            >
              <span
                style={{
                  fontFamily: 'var(--pw-font-display)',
                  fontSize: '24px',
                  fontWeight: 400,
                  color: '#fff',
                }}
              >
                {initials}
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontWeight: 400,
                fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                color: 'var(--pw-ink)',
                lineHeight: 1.1,
              }}
            >
              {tabData.fullName ?? 'Your profile'}
            </h1>
          </div>
        </div>

        {/* ── Personal ── */}
        <div className="pw-entry pw-entry-delay-3">
          <SectionHeader label="PERSONAL" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProfileField label="Full name" value={val(tabData.fullName)} />
            <ProfileField label="Nationality" value={val(tabData.nationality)} />
            <ProfileField
              label="Date of birth"
              value={val(tabData.dateOfBirth)}
            />
            <ProfileField label="Marital status" value={val(tabData.maritalStatus)} />
            <ProfileField label="Country of residence" value={val(tabData.currentCountry)} />
          </div>
        </div>

        {/* ── Education ── */}
        <div className="pw-entry pw-entry-delay-4">
          <SectionHeader label="EDUCATION" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProfileField label="Highest degree" value={val(tabData.educationLevel)} />
            <ProfileField label="Field of study" value={val(tabData.degreeField)} />
            <ProfileField label="Country of study" value={MISSING} />
            <ProfileField
              label="ECA obtained"
              value={tabData.ecaObtained === null ? MISSING : tabData.ecaObtained ? 'Yes' : 'No'}
            />
          </div>
        </div>

        {/* ── Work Experience ── */}
        <div className="pw-entry pw-entry-delay-5">
          <SectionHeader label="WORK EXPERIENCE" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ProfileField label="Occupation / NOC" value={val(tabData.occupation ?? tabData.nocCode)} />
            <ProfileField
              label="NOC TEER category"
              value={tabData.nocTeerCategory !== null ? `TEER ${tabData.nocTeerCategory}` : MISSING}
            />
            <ProfileField
              label="Years of experience"
              value={
                tabData.yearsExperience !== null ? `${tabData.yearsExperience} year${tabData.yearsExperience !== 1 ? 's' : ''}` : MISSING
              }
            />
            <ProfileField
              label="Canadian experience"
              value={tabData.hasCanadianExperience === null ? MISSING : tabData.hasCanadianExperience ? 'Yes' : 'No'}
            />
          </div>
        </div>

        {/* ── Language ── */}
        <div className="pw-entry" style={{ animationDelay: '330ms' }}>
          <SectionHeader label="LANGUAGE" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <ProfileField
              label="Test type"
              value={pathwayInput?.language.self_assessed_level ? `Self-assessed (${pathwayInput.language.self_assessed_level})` : MISSING}
            />
            <ProfileField label="Speaking" value={tabData.clbSpeaking !== null ? `CLB ${tabData.clbSpeaking}` : MISSING} />
            <ProfileField label="Listening" value={tabData.clbListening !== null ? `CLB ${tabData.clbListening}` : MISSING} />
            <ProfileField label="Reading" value={tabData.clbReading !== null ? `CLB ${tabData.clbReading}` : MISSING} />
            <ProfileField label="Writing" value={tabData.clbWriting !== null ? `CLB ${tabData.clbWriting}` : MISSING} />
            {avgClb !== null && (
              <div>
                <p className="pw-eyebrow mb-1" style={{ fontSize: '10px' }}>CLB AVERAGE</p>
                <ClbBar score={avgClb} />
              </div>
            )}
          </div>
        </div>

        {/* ── CRS Estimate ── */}
        {(crsLow !== null || crsHigh !== null) && (
          <div className="pw-entry" style={{ animationDelay: '385ms' }}>
            <SectionHeader label="CRS ESTIMATE" />
            <p
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: '3rem',
                fontWeight: 400,
                color: 'var(--pw-ink)',
                lineHeight: 1,
              }}
            >
              {crsLow ?? '?'}&nbsp;–&nbsp;{crsHigh ?? '?'}
            </p>
            <p
              className="mt-2 mb-3"
              style={{ fontFamily: 'var(--pw-font-body)', fontSize: '13px', color: 'var(--pw-muted)' }}
            >
              Estimated Comprehensive Ranking System score
            </p>
            <p
              style={{ fontFamily: 'var(--pw-font-body)', fontSize: '12px', color: 'var(--pw-muted)' }}
            >
              Final score depends on draw cut-offs. Check latest draws at draws.gc.ca
            </p>
          </div>
        )}

        {/* ── Update CTA ── */}
        <div className="mt-14 pw-entry" style={{ animationDelay: '440ms' }}>
          <Link href="/onboarding" className="pw-btn-secondary">
            Update profile
          </Link>
        </div>
      </main>
    </SwissPageShell>
  );
}
