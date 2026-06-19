'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import type { ProfileTabData } from '@/modules/profile/types';
import { updateProfileFields, recalculateCrsEstimate, type ProfileUpdateFields } from '@/app/actions/profile';
import { resetOnboarding } from '@/app/actions/onboarding';
import type { CrsEstimate } from '@/lib/crs-estimate';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dash(): React.ReactNode {
  return <span style={{ color: '#9B9B9B' }}>—</span>;
}

function display(v: string | number | boolean | null | undefined): React.ReactNode {
  if (v === null || v === undefined) return dash();
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function formatMaritalStatus(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}


function calcCompleteness(d: ProfileTabData): { pct: number; missing: string[] } {
  const checks: { label: string; value: unknown }[] = [
    { label: 'Nationality', value: d.nationality },
    { label: 'Education', value: d.educationLevel },
    { label: 'Language scores', value: d.clbListening },
    { label: 'Work experience', value: d.yearsExperience },
    { label: 'ECA', value: d.ecaObtained },
  ];
  const missing = checks.filter((c) => c.value === null || c.value === undefined).map((c) => c.label);
  const present = checks.length - missing.length;
  return {
    pct: d.profileCompletenessPct ?? Math.round((present / checks.length) * 100),
    missing,
  };
}

function extractStoredEstimate(json: Record<string, unknown> | null): CrsEstimate | null {
  if (!json) return null;
  const est = json['crs_estimate'];
  if (est && typeof est === 'object' && 'score' in est && 'breakdown' in est) {
    return est as CrsEstimate;
  }
  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--pw-font-body)',
  fontSize: 12,
  color: '#9B9B9B',
  flexShrink: 0,
  minWidth: 160,
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--pw-font-body)',
  fontSize: 14,
  color: '#0D0D0D',
  textAlign: 'right',
  flex: 1,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  borderBottom: '1px solid rgba(0,0,0,0.2)',
  borderRadius: 0,
  background: 'transparent',
  fontFamily: 'var(--pw-font-body)',
  fontSize: 14,
  color: '#0D0D0D',
  padding: '2px 0 4px',
  outline: 'none',
  textAlign: 'right',
  transition: 'border-color 150ms ease',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  paddingRight: 16,
};

const rowContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 24,
  padding: '8px 0',
  borderBottom: '1px solid rgba(0,0,0,0.05)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--pw-font-body)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#9B9B9B',
        marginBottom: 8,
      }}
    >
      {children}
    </p>
  );
}

function SectionDivider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 12 }} />;
}

function SaveIndicator({ status }: { status: FieldStatus }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B', flexShrink: 0 }}>
        saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#22C55E', flexShrink: 0 }}>
        ✓
      </span>
    );
  }
  return (
    <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#EF4444', flexShrink: 0 }}>
      error
    </span>
  );
}

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={rowContainerStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

interface InlineEditRowProps {
  label: string;
  initialValue: string | number | null;
  type?: 'text' | 'number';
  status: FieldStatus;
  onSave: (val: string | number | null) => void;
}

function InlineEditRow({ label, initialValue, type = 'text', status, onSave }: InlineEditRowProps) {
  const [local, setLocal] = useState(initialValue !== null ? String(initialValue) : '');
  const prevRef = useRef(local);

  useEffect(() => {
    const s = initialValue !== null ? String(initialValue) : '';
    setLocal(s);
    prevRef.current = s;
  }, [initialValue]);

  function handleBlur() {
    if (local === prevRef.current) return;
    prevRef.current = local;
    if (type === 'number') {
      const n = local === '' ? null : parseFloat(local);
      onSave(Number.isNaN(n as number) ? null : n);
    } else {
      onSave(local === '' ? null : local);
    }
  }

  return (
    <div style={rowContainerStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
        <input
          type={type}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          onFocus={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = '#0D0D0D'; }}
          style={inputStyle}
        />
        <SaveIndicator status={status} />
      </div>
    </div>
  );
}

const EDUCATION_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'less_than_secondary', label: 'Less than secondary' },
  { value: 'secondary', label: 'Secondary (high school)' },
  { value: 'one_year_post_secondary', label: '1-year post-secondary' },
  { value: 'two_year_post_secondary', label: '2-year post-secondary' },
  { value: 'bachelors', label: "Bachelor's degree" },
  { value: 'two_or_more_credentials', label: 'Two or more credentials' },
  { value: 'masters', label: "Master's degree" },
  { value: 'phd', label: 'Doctorate (PhD)' },
];

const NOC_TEER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: '0', label: 'TEER 0 — Management' },
  { value: '1', label: 'TEER 1 — University degree' },
  { value: '2', label: 'TEER 2 — College / 2+ yr apprenticeship' },
  { value: '3', label: 'TEER 3 — College / under-2-yr apprenticeship' },
  { value: '4', label: 'TEER 4 — High school diploma' },
  { value: '5', label: 'TEER 5 — Short-term training' },
];

const BOOLEAN_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

interface InlineSelectRowProps {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  status: FieldStatus;
  onSave: (val: string | null) => void;
}

function InlineSelectRow({ label, value, options, status, onSave }: InlineSelectRowProps) {
  const current = value ?? '';

  return (
    <div style={rowContainerStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
        <select
          value={current}
          onChange={(e) => {
            const v = e.target.value;
            onSave(v === '' ? null : v);
          }}
          style={selectStyle}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <SaveIndicator status={status} />
      </div>
    </div>
  );
}

interface InlineBooleanRowProps {
  label: string;
  value: boolean | null;
  status: FieldStatus;
  onSave: (val: boolean | null) => void;
}

function InlineBooleanRow({ label, value, status, onSave }: InlineBooleanRowProps) {
  const current = value === null ? '' : String(value);

  return (
    <div style={rowContainerStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
        <select
          value={current}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onSave(null);
            else onSave(v === 'true');
          }}
          style={selectStyle}
        >
          {BOOLEAN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <SaveIndicator status={status} />
      </div>
    </div>
  );
}

function CrsCard({
  estimate,
  isDirty,
  isRecalculating,
  lastRecalcAt,
  onRecalculate,
}: {
  estimate: CrsEstimate | null;
  isDirty: boolean;
  isRecalculating: boolean;
  lastRecalcAt: string | null;
  onRecalculate: () => void;
}) {
  const canRecalc = isDirty && !isRecalculating;

  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 36,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <SectionLabel>CRS SCORE ESTIMATE</SectionLabel>
          {estimate ? (
            <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '2.25rem', color: '#0D0D0D', lineHeight: 1 }}>
              {estimate.score}
            </p>
          ) : (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#9B9B9B' }}>
              No estimate yet — edit your profile and click Recalculate.
            </p>
          )}
          {estimate && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 12, color: '#9B9B9B', marginTop: 4 }}>
              Range {estimate.low}–{estimate.high} (±{estimate.margin} pts)
            </p>
          )}
          {lastRecalcAt && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B', marginTop: 4 }}>
              Last updated {new Date(lastRecalcAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRecalculate}
          disabled={!canRecalc}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 18px',
            fontFamily: 'var(--pw-font-body)',
            fontSize: 13,
            color: canRecalc ? '#FFFFFF' : '#9B9B9B',
            background: canRecalc ? '#0D0D0D' : 'rgba(0,0,0,0.06)',
            borderRadius: 9999,
            border: 'none',
            cursor: canRecalc ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          {isRecalculating ? 'Calculating…' : 'Recalculate score'}
        </button>
      </div>

      {estimate && (
        <>
          {estimate.belowCutoff && (
            <div
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 14,
                fontFamily: 'var(--pw-font-body)',
                fontSize: 12,
                color: '#EF4444',
              }}
            >
              {estimate.cutoffReason}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
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
                  borderRadius: 8,
                }}
              >
                <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.125rem', color: '#0D0D0D' }}>
                  {pts}
                </p>
                <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, color: '#9B9B9B', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
                  {cat}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileClientProps {
  data: ProfileTabData;
}

/** Renders the full Profile tab with per-field inline editing. */
export function ProfileClient({ data: initialData }: ProfileClientProps) {
  const [data, setData] = useState<ProfileTabData>(initialData);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldStatus>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isRecalculating, startRecalcTransition] = useTransition();
  const [crsEstimate, setCrsEstimate] = useState<CrsEstimate | null>(
    () => extractStoredEstimate(initialData.pathwayInputJson)
  );
  const [lastRecalcAt, setLastRecalcAt] = useState<string | null>(
    () => (initialData.pathwayInputJson?.['crs_recalculated_at'] as string | null) ?? null
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      const els = document.querySelectorAll<HTMLElement>('.pw-entry');
      els.forEach((el, i) => {
        setTimeout(() => el.classList.add('is-visible'), i * 55);
      });
    });
  }, []);

  function setFieldStatus(key: string, status: FieldStatus) {
    setFieldStates((prev) => ({ ...prev, [key]: status }));
  }

  async function saveField(
    dbColumn: keyof ProfileUpdateFields,
    value: ProfileUpdateFields[keyof ProfileUpdateFields],
    dataKey: keyof ProfileTabData
  ) {
    setFieldStatus(dbColumn, 'saving');
    try {
      await updateProfileFields({ [dbColumn]: value } as ProfileUpdateFields);
      setData((prev) => ({ ...prev, [dataKey]: value }));
      setIsDirty(true);
      setFieldStatus(dbColumn, 'saved');
      setTimeout(() => setFieldStatus(dbColumn, 'idle'), 2000);
    } catch {
      setFieldStatus(dbColumn, 'error');
    }
  }

  function handleRecalculate() {
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
      setIsDirty(false);
    });
  }

  const { pct, missing } = calcCompleteness(data);

  return (
    <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
      <div style={{ maxWidth: 900 }}>
        {/* Page header */}
        <div className="pw-entry" style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9B9B9B', marginBottom: 6 }}>
            PROFILE
          </p>
          <h1 style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.875rem', color: '#0D0D0D', lineHeight: 1.2 }}>
            Your immigration profile
          </h1>
        </div>

        {/* Completeness bar */}
        <div className="pw-entry" style={{ marginBottom: 28 }}>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9B9B9B', marginBottom: 8 }}>
            PROFILE COMPLETENESS
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 2, background: 'rgba(0,0,0,0.07)', borderRadius: 1, overflow: 'hidden' }}>
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
            <span style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.125rem', color: '#0D0D0D', flexShrink: 0 }}>
              {pct}%
            </span>
          </div>
          {missing.length > 0 && (
            <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 11, color: '#9B9B9B' }}>
              Missing: {missing.join(', ')}
            </p>
          )}
        </div>

        {/* CRS summary card */}
        <div className="pw-entry">
          <CrsCard
            estimate={crsEstimate}
            isDirty={isDirty}
            isRecalculating={isRecalculating}
            lastRecalcAt={lastRecalcAt}
            onRecalculate={handleRecalculate}
          />
        </div>

        {/* Two-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 40,
            marginBottom: 40,
          }}
        >
          {/* ── Left column ─────────────────────────────────────────────── */}
          <div>
            {/* Personal details */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionLabel>PERSONAL DETAILS</SectionLabel>
              <SectionDivider />
              <InlineEditRow
                label="Full name"
                initialValue={data.fullName}
                status={fieldStates['full_name'] ?? 'idle'}
                onSave={(v) => saveField('full_name', v as string | null, 'fullName')}
              />
              <InlineEditRow
                label="Nationality"
                initialValue={data.nationality}
                status={fieldStates['nationality'] ?? 'idle'}
                onSave={(v) => saveField('nationality', v as string | null, 'nationality')}
              />
              <ProfileRow label="Date of birth" value={display(data.dateOfBirth)} />
              <InlineEditRow
                label="Current country"
                initialValue={data.currentCountry}
                status={fieldStates['current_country'] ?? 'idle'}
                onSave={(v) => saveField('current_country', v as string | null, 'currentCountry')}
              />
              <ProfileRow label="Marital status" value={display(formatMaritalStatus(data.maritalStatus))} />
            </div>

            {/* Immigration intent */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionLabel>IMMIGRATION INTENT</SectionLabel>
              <SectionDivider />
              <InlineEditRow
                label="Intended province"
                initialValue={data.intendedProvince}
                status={fieldStates['intended_province'] ?? 'idle'}
                onSave={(v) => saveField('intended_province', v as string | null, 'intendedProvince')}
              />
              <InlineBooleanRow
                label="Family in Canada"
                value={data.hasFamilyInCanada}
                status={fieldStates['has_family_in_canada'] ?? 'idle'}
                onSave={(v) => saveField('has_family_in_canada', v, 'hasFamilyInCanada')}
              />
            </div>

            {/* Spouse */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionLabel>SPOUSE / PARTNER</SectionLabel>
              <SectionDivider />
              <InlineBooleanRow
                label="Coming to Canada"
                value={data.spouseComingToCanada}
                status={fieldStates['spouse_coming_to_canada'] ?? 'idle'}
                onSave={(v) => saveField('spouse_coming_to_canada', v, 'spouseComingToCanada')}
              />
              {data.spouseComingToCanada === true && (
                <>
                  <InlineSelectRow
                    label="Education level"
                    value={data.spouseEducationLevel}
                    options={EDUCATION_OPTIONS}
                    status={fieldStates['spouse_education_level'] ?? 'idle'}
                    onSave={(v) => saveField('spouse_education_level', v as string | null, 'spouseEducationLevel')}
                  />
                  <InlineEditRow
                    label="CLB Listening"
                    initialValue={data.spouseClbListening}
                    type="number"
                    status={fieldStates['spouse_clb_listening'] ?? 'idle'}
                    onSave={(v) => saveField('spouse_clb_listening', v as number | null, 'spouseClbListening')}
                  />
                  <InlineEditRow
                    label="CLB Reading"
                    initialValue={data.spouseClbReading}
                    type="number"
                    status={fieldStates['spouse_clb_reading'] ?? 'idle'}
                    onSave={(v) => saveField('spouse_clb_reading', v as number | null, 'spouseClbReading')}
                  />
                  <InlineEditRow
                    label="CLB Speaking"
                    initialValue={data.spouseClbSpeaking}
                    type="number"
                    status={fieldStates['spouse_clb_speaking'] ?? 'idle'}
                    onSave={(v) => saveField('spouse_clb_speaking', v as number | null, 'spouseClbSpeaking')}
                  />
                  <InlineEditRow
                    label="CLB Writing"
                    initialValue={data.spouseClbWriting}
                    type="number"
                    status={fieldStates['spouse_clb_writing'] ?? 'idle'}
                    onSave={(v) => saveField('spouse_clb_writing', v as number | null, 'spouseClbWriting')}
                  />
                  <InlineEditRow
                    label="Canadian work years"
                    initialValue={data.spouseCanadianWorkYears}
                    type="number"
                    status={fieldStates['spouse_canadian_work_years'] ?? 'idle'}
                    onSave={(v) => saveField('spouse_canadian_work_years', v as number | null, 'spouseCanadianWorkYears')}
                  />
                </>
              )}
            </div>

            {/* CRS bonus factors */}
            <div className="pw-entry">
              <SectionLabel>CRS BONUS FACTORS</SectionLabel>
              <SectionDivider />
              <InlineBooleanRow
                label="Provincial nomination"
                value={data.hasProvincialNomination}
                status={fieldStates['has_provincial_nomination'] ?? 'idle'}
                onSave={(v) => saveField('has_provincial_nomination', v, 'hasProvincialNomination')}
              />
              <InlineBooleanRow
                label="Canadian job offer"
                value={data.hasCanadianJobOffer}
                status={fieldStates['has_canadian_job_offer'] ?? 'idle'}
                onSave={(v) => saveField('has_canadian_job_offer', v, 'hasCanadianJobOffer')}
              />
              <InlineBooleanRow
                label="Sibling in Canada"
                value={data.hasSiblingInCanada}
                status={fieldStates['has_sibling_in_canada'] ?? 'idle'}
                onSave={(v) => saveField('has_sibling_in_canada', v, 'hasSiblingInCanada')}
              />
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────────── */}
          <div>
            {/* Language scores */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionLabel>LANGUAGE SCORES</SectionLabel>
              <SectionDivider />
              <ProfileRow label="Proficiency level" value={display(data.englishLevel)} />
              <InlineEditRow
                label="CLB Listening"
                initialValue={data.clbListening}
                type="number"
                status={fieldStates['clb_listening'] ?? 'idle'}
                onSave={(v) => saveField('clb_listening', v as number | null, 'clbListening')}
              />
              <InlineEditRow
                label="CLB Reading"
                initialValue={data.clbReading}
                type="number"
                status={fieldStates['clb_reading'] ?? 'idle'}
                onSave={(v) => saveField('clb_reading', v as number | null, 'clbReading')}
              />
              <InlineEditRow
                label="CLB Speaking"
                initialValue={data.clbSpeaking}
                type="number"
                status={fieldStates['clb_speaking'] ?? 'idle'}
                onSave={(v) => saveField('clb_speaking', v as number | null, 'clbSpeaking')}
              />
              <InlineEditRow
                label="CLB Writing"
                initialValue={data.clbWriting}
                type="number"
                status={fieldStates['clb_writing'] ?? 'idle'}
                onSave={(v) => saveField('clb_writing', v as number | null, 'clbWriting')}
              />
            </div>

            {/* Education */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionLabel>EDUCATION</SectionLabel>
              <SectionDivider />
              <InlineSelectRow
                label="Highest level"
                value={EDUCATION_OPTIONS.some((o) => o.value === data.educationLevel) ? data.educationLevel : null}
                options={EDUCATION_OPTIONS}
                status={fieldStates['education_level'] ?? 'idle'}
                onSave={(v) => {
                  saveField('education_level', v as string | null, 'educationLevel');
                }}
              />
              <InlineEditRow
                label="Field of study"
                initialValue={data.degreeField}
                status={fieldStates['degree_field'] ?? 'idle'}
                onSave={(v) => saveField('degree_field', v as string | null, 'degreeField')}
              />
              <InlineBooleanRow
                label="ECA obtained"
                value={data.ecaObtained}
                status={fieldStates['eca_obtained'] ?? 'idle'}
                onSave={(v) => saveField('eca_obtained', v, 'ecaObtained')}
              />
            </div>

            {/* Work experience */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionLabel>WORK EXPERIENCE</SectionLabel>
              <SectionDivider />
              <InlineEditRow
                label="Occupation"
                initialValue={data.occupation}
                status={fieldStates['occupation'] ?? 'idle'}
                onSave={(v) => saveField('occupation', v as string | null, 'occupation')}
              />
              <InlineEditRow
                label="Years (total)"
                initialValue={data.yearsExperience}
                type="number"
                status={fieldStates['years_experience'] ?? 'idle'}
                onSave={(v) => saveField('years_experience', v as number | null, 'yearsExperience')}
              />
              <InlineSelectRow
                label="NOC TEER category"
                value={data.nocTeerCategory !== null ? String(data.nocTeerCategory) : null}
                options={NOC_TEER_OPTIONS}
                status={fieldStates['noc_teer_category'] ?? 'idle'}
                onSave={(v) => {
                  const n = v === null ? null : parseInt(v, 10);
                  saveField('noc_teer_category', Number.isNaN(n as number) ? null : n, 'nocTeerCategory');
                }}
              />
              <InlineEditRow
                label="NOC code"
                initialValue={data.nocCode}
                status={fieldStates['noc_code'] ?? 'idle'}
                onSave={(v) => saveField('noc_code', v as string | null, 'nocCode')}
              />
              <InlineBooleanRow
                label="Canadian experience"
                value={data.hasCanadianExperience}
                status={fieldStates['has_canadian_experience'] ?? 'idle'}
                onSave={(v) => saveField('has_canadian_experience', v, 'hasCanadianExperience')}
              />
            </div>

            {/* Work history */}
            <div className="pw-entry">
              <SectionLabel>WORK HISTORY</SectionLabel>
              <SectionDivider />
              <InlineEditRow
                label="Canadian work years"
                initialValue={data.canadianWorkYears}
                type="number"
                status={fieldStates['canadian_work_years'] ?? 'idle'}
                onSave={(v) => saveField('canadian_work_years', v as number | null, 'canadianWorkYears')}
              />
              <InlineEditRow
                label="Foreign work years"
                initialValue={data.foreignWorkYears}
                type="number"
                status={fieldStates['foreign_work_years'] ?? 'idle'}
                onSave={(v) => saveField('foreign_work_years', v as number | null, 'foreignWorkYears')}
              />
              <InlineBooleanRow
                label="Canadian work recent"
                value={data.canadianWorkRecent}
                status={fieldStates['canadian_work_recent'] ?? 'idle'}
                onSave={(v) => saveField('canadian_work_recent', v, 'canadianWorkRecent')}
              />
              <InlineBooleanRow
                label="Foreign work recent"
                value={data.foreignWorkRecent}
                status={fieldStates['foreign_work_recent'] ?? 'idle'}
                onSave={(v) => saveField('foreign_work_recent', v, 'foreignWorkRecent')}
              />
            </div>
          </div>
        </div>

        {/* Redo onboarding */}
        <div
          className="pw-entry"
          style={{
            borderTop: '1px solid rgba(0,0,0,0.07)',
            paddingTop: 32,
            marginTop: 8,
          }}
        >
          <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1rem', color: '#0D0D0D', marginBottom: 6 }}>
            Want to start fresh?
          </p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 13, color: '#9B9B9B', marginBottom: 16, lineHeight: 1.5 }}>
            Redoing your onboarding will replace your current profile with a new voice session.
          </p>
          <form action={resetOnboarding}>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '7px 16px',
                fontFamily: 'var(--pw-font-body)',
                fontSize: 13,
                color: '#9B9B9B',
                background: 'transparent',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 9999,
                cursor: 'pointer',
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
