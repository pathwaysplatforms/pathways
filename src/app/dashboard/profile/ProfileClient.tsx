'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileTabData, ProfileDraft } from '@/modules/profile/types';
import { updateProfileFields } from '@/app/actions/profile';
import { resetOnboarding } from '@/app/actions/onboarding';

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
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  editing: boolean;
  onEdit: () => void;
}

function SectionHeader({ label, editing, onEdit }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#9B9B9B',
          }}
        >
          {label}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 11,
              color: '#6B6B6B',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            Edit
          </button>
        )}
      </div>
      <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBottom: 12 }} />
    </div>
  );
}

interface ProfileRowProps {
  label: string;
  value: React.ReactNode;
}

function ProfileRow({ label, value }: ProfileRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 24,
        padding: '8px 0',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 12,
          color: '#9B9B9B',
          flexShrink: 0,
          minWidth: 140,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 14,
          color: '#0D0D0D',
          textAlign: 'right',
          flex: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface EditableRowProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: 'text' | 'number';
}

function EditableRow({ label, value, onChange, type = 'text' }: EditableRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 24,
        padding: '8px 0',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 12,
          color: '#9B9B9B',
          flexShrink: 0,
          minWidth: 140,
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
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
        }}
        onFocus={(e) => {
          (e.target as HTMLInputElement).style.borderBottomColor = '#0D0D0D';
        }}
        onBlur={(e) => {
          (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(0,0,0,0.2)';
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileClientProps {
  data: ProfileTabData;
}

/** Renders the full Profile tab with per-section edit mode. */
export function ProfileClient({ data }: ProfileClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<ProfileTabData>(data);
  const [draft, setDraft] = useState<ProfileDraft>({
    fullName: data.fullName,
    nationality: data.nationality,
    currentCountry: data.currentCountry,
    occupation: data.occupation,
    yearsExperience: data.yearsExperience,
    educationLevel: data.educationLevel,
    degreeField: data.degreeField,
    intendedProvince: data.intendedProvince,
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      const els = document.querySelectorAll<HTMLElement>('.pw-entry');
      els.forEach((el, i) => {
        setTimeout(() => el.classList.add('is-visible'), i * 55);
      });
    });
  }, []);

  function startEdit(section: string) {
    setDraft({
      fullName: savedData.fullName,
      nationality: savedData.nationality,
      currentCountry: savedData.currentCountry,
      occupation: savedData.occupation,
      yearsExperience: savedData.yearsExperience,
      educationLevel: savedData.educationLevel,
      degreeField: savedData.degreeField,
      intendedProvince: savedData.intendedProvince,
    });
    setEditingSection(section);
  }

  function cancelEdit() {
    setEditingSection(null);
  }

  function handleSave() {
    startTransition(async () => {
      await updateProfileFields({
        full_name: draft.fullName ?? undefined,
        nationality: draft.nationality ?? undefined,
        current_country: draft.currentCountry ?? undefined,
        occupation: draft.occupation ?? undefined,
        years_experience: draft.yearsExperience ?? undefined,
        education_level_voice: draft.educationLevel ?? undefined,
        degree_field: draft.degreeField ?? undefined,
        intended_province: draft.intendedProvince ?? undefined,
      });

      setSavedData((prev) => ({
        ...prev,
        fullName: draft.fullName,
        nationality: draft.nationality,
        currentCountry: draft.currentCountry,
        occupation: draft.occupation,
        yearsExperience: draft.yearsExperience,
        educationLevel: draft.educationLevel,
        degreeField: draft.degreeField,
        intendedProvince: draft.intendedProvince,
      }));
      setEditingSection(null);
      router.refresh();
    });
  }

  function updateDraft(key: keyof ProfileDraft, raw: string) {
    if (key === 'yearsExperience') {
      const n = parseInt(raw, 10);
      setDraft((prev) => ({ ...prev, [key]: Number.isNaN(n) ? null : n }));
    } else {
      setDraft((prev) => ({ ...prev, [key]: raw || null }));
    }
  }

  const { pct, missing } = calcCompleteness(savedData);
  const isEditing = editingSection !== null;

  return (
    <div className="flex-1 overflow-y-auto p-[28px] relative z-10">
      <div style={{ maxWidth: 900 }}>
        {/* Page header */}
        <div className="pw-entry" style={{ marginBottom: 28 }}>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#9B9B9B',
              marginBottom: 6,
            }}
          >
            PROFILE
          </p>
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

        {/* Completeness bar */}
        <div className="pw-entry" style={{ marginBottom: 36 }}>
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
            PROFILE COMPLETENESS
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
            <div
              style={{
                flex: 1,
                height: 2,
                background: 'rgba(0,0,0,0.07)',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
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
            <span
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: '1.125rem',
                color: '#0D0D0D',
                flexShrink: 0,
              }}
            >
              {pct}%
            </span>
          </div>
          {missing.length > 0 && (
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 11,
                color: '#9B9B9B',
              }}
            >
              Missing: {missing.join(', ')}
            </p>
          )}
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
          {/* Left column */}
          <div>
            {/* Personal details */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionHeader
                label="PERSONAL DETAILS"
                editing={editingSection === 'personal'}
                onEdit={() => startEdit('personal')}
              />

              {editingSection === 'personal' ? (
                <>
                  <EditableRow
                    label="Full name"
                    value={draft.fullName ?? ''}
                    onChange={(v) => updateDraft('fullName', v)}
                  />
                  <EditableRow
                    label="Nationality"
                    value={draft.nationality ?? ''}
                    onChange={(v) => updateDraft('nationality', v)}
                  />
                  <ProfileRow label="Date of birth" value={display(savedData.dateOfBirth)} />
                  <EditableRow
                    label="Current country"
                    value={draft.currentCountry ?? ''}
                    onChange={(v) => updateDraft('currentCountry', v)}
                  />
                  <ProfileRow
                    label="Marital status"
                    value={display(formatMaritalStatus(savedData.maritalStatus))}
                  />
                </>
              ) : (
                <>
                  <ProfileRow label="Full name" value={display(savedData.fullName)} />
                  <ProfileRow label="Nationality" value={display(savedData.nationality)} />
                  <ProfileRow label="Date of birth" value={display(savedData.dateOfBirth)} />
                  <ProfileRow label="Current country" value={display(savedData.currentCountry)} />
                  <ProfileRow
                    label="Marital status"
                    value={display(formatMaritalStatus(savedData.maritalStatus))}
                  />
                </>
              )}

              {editingSection === 'personal' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 18px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      background: isPending ? '#999' : '#0D0D0D',
                      borderRadius: 9999,
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '7px 16px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      color: '#6B6B6B',
                      background: 'transparent',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 9999,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Immigration intent */}
            <div className="pw-entry">
              <SectionHeader
                label="IMMIGRATION INTENT"
                editing={editingSection === 'intent'}
                onEdit={() => startEdit('intent')}
              />

              {editingSection === 'intent' ? (
                <>
                  <EditableRow
                    label="Intended province"
                    value={draft.intendedProvince ?? ''}
                    onChange={(v) => updateDraft('intendedProvince', v)}
                  />
                  <ProfileRow label="Family in Canada" value={display(savedData.hasFamilyInCanada)} />
                  <ProfileRow
                    label="Provincial nomination"
                    value={display(savedData.hasProvincialNomination)}
                  />
                </>
              ) : (
                <>
                  <ProfileRow label="Intended province" value={display(savedData.intendedProvince)} />
                  <ProfileRow label="Family in Canada" value={display(savedData.hasFamilyInCanada)} />
                  <ProfileRow
                    label="Provincial nomination"
                    value={display(savedData.hasProvincialNomination)}
                  />
                </>
              )}

              {editingSection === 'intent' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 18px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      background: isPending ? '#999' : '#0D0D0D',
                      borderRadius: 9999,
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '7px 16px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      color: '#6B6B6B',
                      background: 'transparent',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 9999,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div>
            {/* Language scores */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionHeader
                label="LANGUAGE SCORES"
                editing={false}
                onEdit={() => {}}
              />
              <ProfileRow
                label="Proficiency level"
                value={display(savedData.englishLevel)}
              />
              <ProfileRow
                label="CLB Listening"
                value={savedData.clbListening !== null ? `CLB ${savedData.clbListening}` : dash()}
              />
              <ProfileRow
                label="CLB Reading"
                value={savedData.clbReading !== null ? `CLB ${savedData.clbReading}` : dash()}
              />
              <ProfileRow
                label="CLB Speaking"
                value={savedData.clbSpeaking !== null ? `CLB ${savedData.clbSpeaking}` : dash()}
              />
              <ProfileRow
                label="CLB Writing"
                value={savedData.clbWriting !== null ? `CLB ${savedData.clbWriting}` : dash()}
              />
            </div>

            {/* Education */}
            <div className="pw-entry" style={{ marginBottom: 32 }}>
              <SectionHeader
                label="EDUCATION"
                editing={editingSection === 'education'}
                onEdit={() => startEdit('education')}
              />

              {editingSection === 'education' ? (
                <>
                  <EditableRow
                    label="Highest level"
                    value={draft.educationLevel ?? ''}
                    onChange={(v) => updateDraft('educationLevel', v)}
                  />
                  <EditableRow
                    label="Field of study"
                    value={draft.degreeField ?? ''}
                    onChange={(v) => updateDraft('degreeField', v)}
                  />
                  <ProfileRow label="ECA obtained" value={display(savedData.ecaObtained)} />
                </>
              ) : (
                <>
                  <ProfileRow label="Highest level" value={display(savedData.educationLevel)} />
                  <ProfileRow label="Field of study" value={display(savedData.degreeField)} />
                  <ProfileRow label="ECA obtained" value={display(savedData.ecaObtained)} />
                </>
              )}

              {editingSection === 'education' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 18px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      background: isPending ? '#999' : '#0D0D0D',
                      borderRadius: 9999,
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '7px 16px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      color: '#6B6B6B',
                      background: 'transparent',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 9999,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Work experience */}
            <div className="pw-entry">
              <SectionHeader
                label="WORK EXPERIENCE"
                editing={editingSection === 'work'}
                onEdit={() => startEdit('work')}
              />

              {editingSection === 'work' ? (
                <>
                  <EditableRow
                    label="Occupation"
                    value={draft.occupation ?? ''}
                    onChange={(v) => updateDraft('occupation', v)}
                  />
                  <EditableRow
                    label="Years of experience"
                    value={draft.yearsExperience !== null ? String(draft.yearsExperience) : ''}
                    onChange={(v) => updateDraft('yearsExperience', v)}
                    type="number"
                  />
                  <ProfileRow
                    label="NOC code"
                    value={
                      savedData.nocCode
                        ? `${savedData.nocCode}${savedData.nocTeerCategory !== null ? ` (TEER ${savedData.nocTeerCategory})` : ''}`
                        : dash()
                    }
                  />
                  <ProfileRow
                    label="Canadian experience"
                    value={display(savedData.hasCanadianExperience)}
                  />
                </>
              ) : (
                <>
                  <ProfileRow label="Occupation" value={display(savedData.occupation)} />
                  <ProfileRow
                    label="Years of experience"
                    value={
                      savedData.yearsExperience !== null
                        ? `${savedData.yearsExperience} year${savedData.yearsExperience !== 1 ? 's' : ''}`
                        : dash()
                    }
                  />
                  <ProfileRow
                    label="NOC code"
                    value={
                      savedData.nocCode
                        ? `${savedData.nocCode}${savedData.nocTeerCategory !== null ? ` (TEER ${savedData.nocTeerCategory})` : ''}`
                        : dash()
                    }
                  />
                  <ProfileRow
                    label="Canadian experience"
                    value={display(savedData.hasCanadianExperience)}
                  />
                </>
              )}

              {editingSection === 'work' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 18px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      background: isPending ? '#999' : '#0D0D0D',
                      borderRadius: 9999,
                      border: 'none',
                      cursor: isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isPending}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '7px 16px',
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 13,
                      color: '#6B6B6B',
                      background: 'transparent',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: 9999,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
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
              disabled={isEditing || isPending}
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
                cursor: isEditing || isPending ? 'not-allowed' : 'pointer',
                opacity: isEditing || isPending ? 0.5 : 1,
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
