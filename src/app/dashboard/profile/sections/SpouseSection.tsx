'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, NumberInput, SelectInput, BooleanSelect, displayValue, displayEnum, displayBool, EDUCATION_OPTIONS } from './shared';
import type { SectionProps } from './shared';

/** Profile section: Spouse / Partner details (conditional on spouseComingToCanada). */
export function SpouseSection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [spouseComingToCanada, setSpouseComingToCanada] = useState<boolean | null>(data.spouseComingToCanada);
  const [spouseEducationLevel, setSpouseEducationLevel] = useState<string | null>(data.spouseEducationLevel);
  const [spouseClbListening, setSpouseClbListening] = useState<number | null>(data.spouseClbListening);
  const [spouseClbReading, setSpouseClbReading] = useState<number | null>(data.spouseClbReading);
  const [spouseClbSpeaking, setSpouseClbSpeaking] = useState<number | null>(data.spouseClbSpeaking);
  const [spouseClbWriting, setSpouseClbWriting] = useState<number | null>(data.spouseClbWriting);
  const [spouseCanadianWorkYears, setSpouseCanadianWorkYears] = useState<number | null>(data.spouseCanadianWorkYears);

  // Display: if no spouse info at all and not editing, show quiet empty state
  const showSpouseDetails = spouseComingToCanada === true;
  const showDataSpouseDetails = data.spouseComingToCanada === true;

  function handleEdit() {
    setSpouseComingToCanada(data.spouseComingToCanada);
    setSpouseEducationLevel(data.spouseEducationLevel);
    setSpouseClbListening(data.spouseClbListening);
    setSpouseClbReading(data.spouseClbReading);
    setSpouseClbSpeaking(data.spouseClbSpeaking);
    setSpouseClbWriting(data.spouseClbWriting);
    setSpouseCanadianWorkYears(data.spouseCanadianWorkYears);
    setSaveError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        fields: {
          spouse_coming_to_canada: spouseComingToCanada,
          spouse_education_level: spouseComingToCanada ? (spouseEducationLevel as Parameters<typeof onSave>[0]['fields']['spouse_education_level']) : null,
          spouse_clb_listening: spouseComingToCanada ? spouseClbListening : null,
          spouse_clb_reading: spouseComingToCanada ? spouseClbReading : null,
          spouse_clb_speaking: spouseComingToCanada ? spouseClbSpeaking : null,
          spouse_clb_writing: spouseComingToCanada ? spouseClbWriting : null,
          spouse_canadian_work_years: spouseComingToCanada ? spouseCanadianWorkYears : null,
        },
        recalculate: true,
      });
      setIsEditing(false);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const notApplicable = (
    <span style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#9B9B9B' }}>
      Not applicable
    </span>
  );

  return (
    <SectionCard
      title="Spouse / Partner"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Coming to Canada"
        isEditing={isEditing}
        readContent={displayBool(data.spouseComingToCanada)}
        editContent={<BooleanSelect value={spouseComingToCanada} onChange={setSpouseComingToCanada} />}
      />

      {/* Read: only show spouse detail rows when applicable */}
      {!isEditing && showDataSpouseDetails && (
        <>
          <FieldRow label="Education level" isEditing={false} readContent={displayEnum(data.spouseEducationLevel, EDUCATION_OPTIONS)} />
          <FieldRow label="CLB Listening" isEditing={false} readContent={displayValue(data.spouseClbListening)} />
          <FieldRow label="CLB Reading" isEditing={false} readContent={displayValue(data.spouseClbReading)} />
          <FieldRow label="CLB Speaking" isEditing={false} readContent={displayValue(data.spouseClbSpeaking)} />
          <FieldRow label="CLB Writing" isEditing={false} readContent={displayValue(data.spouseClbWriting)} />
          <FieldRow label="Canadian work (yrs)" isEditing={false} readContent={displayValue(data.spouseCanadianWorkYears)} isLast />
        </>
      )}

      {/* Read: not applicable when spouse not coming */}
      {!isEditing && !showDataSpouseDetails && data.spouseComingToCanada === false && (
        <FieldRow label="Details" isEditing={false} readContent={notApplicable} isLast />
      )}

      {/* Edit: conditionally show spouse detail inputs */}
      {isEditing && showSpouseDetails && (
        <>
          <FieldRow
            label="Education level"
            isEditing={true}
            readContent={displayEnum(data.spouseEducationLevel, EDUCATION_OPTIONS)}
            editContent={<SelectInput value={spouseEducationLevel} onChange={setSpouseEducationLevel} options={EDUCATION_OPTIONS} />}
          />
          <FieldRow
            label="CLB Listening"
            isEditing={true}
            readContent={displayValue(data.spouseClbListening)}
            editContent={<NumberInput value={spouseClbListening} onChange={setSpouseClbListening} min={0} max={12} />}
          />
          <FieldRow
            label="CLB Reading"
            isEditing={true}
            readContent={displayValue(data.spouseClbReading)}
            editContent={<NumberInput value={spouseClbReading} onChange={setSpouseClbReading} min={0} max={12} />}
          />
          <FieldRow
            label="CLB Speaking"
            isEditing={true}
            readContent={displayValue(data.spouseClbSpeaking)}
            editContent={<NumberInput value={spouseClbSpeaking} onChange={setSpouseClbSpeaking} min={0} max={12} />}
          />
          <FieldRow
            label="CLB Writing"
            isEditing={true}
            readContent={displayValue(data.spouseClbWriting)}
            editContent={<NumberInput value={spouseClbWriting} onChange={setSpouseClbWriting} min={0} max={12} />}
          />
          <FieldRow
            label="Canadian work (yrs)"
            isEditing={true}
            readContent={displayValue(data.spouseCanadianWorkYears)}
            editContent={<NumberInput value={spouseCanadianWorkYears} onChange={setSpouseCanadianWorkYears} min={0} max={60} />}
            isLast
          />
        </>
      )}
    </SectionCard>
  );
}
