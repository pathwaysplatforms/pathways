'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, TextInput, NumberInput, SelectInput, BooleanSelect, displayValue, displayEnum, displayBool, NOC_TEER_OPTIONS } from './shared';
import type { SectionProps } from './shared';

/** Profile section: Occupation (job title, years, NOC, Canadian experience). */
export function OccupationSection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [occupation, setOccupation] = useState(data.occupation ?? '');
  const [yearsExperience, setYearsExperience] = useState<number | null>(data.yearsExperience);
  const [nocTeerCategory, setNocTeerCategory] = useState<string | null>(
    data.nocTeerCategory !== null ? String(data.nocTeerCategory) : null
  );
  const [nocCode, setNocCode] = useState(data.nocCode ?? '');
  const [hasCanadianExperience, setHasCanadianExperience] = useState<boolean | null>(data.hasCanadianExperience);

  function handleEdit() {
    setOccupation(data.occupation ?? '');
    setYearsExperience(data.yearsExperience);
    setNocTeerCategory(data.nocTeerCategory !== null ? String(data.nocTeerCategory) : null);
    setNocCode(data.nocCode ?? '');
    setHasCanadianExperience(data.hasCanadianExperience);
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
    const nocTeer = nocTeerCategory === null ? null : parseInt(nocTeerCategory, 10);
    try {
      await onSave({
        fields: {
          occupation: occupation || null,
          years_experience: yearsExperience,
          noc_teer_category: Number.isNaN(nocTeer as number) ? null : nocTeer,
          noc_code: nocCode || null,
          has_canadian_experience: hasCanadianExperience,
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

  return (
    <SectionCard
      title="Occupation"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Occupation"
        isEditing={isEditing}
        readContent={displayValue(data.occupation)}
        editContent={<TextInput value={occupation} onChange={setOccupation} />}
      />
      <FieldRow
        label="Years experience"
        isEditing={isEditing}
        readContent={displayValue(data.yearsExperience)}
        editContent={<NumberInput value={yearsExperience} onChange={setYearsExperience} min={0} max={60} />}
      />
      <FieldRow
        label="NOC TEER"
        isEditing={isEditing}
        readContent={displayEnum(
          data.nocTeerCategory !== null ? String(data.nocTeerCategory) : null,
          NOC_TEER_OPTIONS
        )}
        editContent={<SelectInput value={nocTeerCategory} onChange={setNocTeerCategory} options={NOC_TEER_OPTIONS} />}
      />
      <FieldRow
        label="NOC code"
        isEditing={isEditing}
        readContent={displayValue(data.nocCode)}
        editContent={<TextInput value={nocCode} onChange={setNocCode} />}
      />
      <FieldRow
        label="Canadian experience"
        isEditing={isEditing}
        readContent={displayBool(data.hasCanadianExperience)}
        editContent={<BooleanSelect value={hasCanadianExperience} onChange={setHasCanadianExperience} />}
        isLast
      />
    </SectionCard>
  );
}
