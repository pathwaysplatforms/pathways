'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, TextInput, SelectInput, BooleanSelect, displayEnum, displayBool, displayValue, EDUCATION_OPTIONS } from './shared';
import type { SectionProps } from './shared';

/** Profile section: Education (level, field of study, ECA). */
export function EducationSection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [educationLevel, setEducationLevel] = useState<string | null>(
    // Normalise to enum values only; voice free-text falls back to empty
    EDUCATION_OPTIONS.some((o) => o.value === data.educationLevel) ? data.educationLevel : null
  );
  const [degreeField, setDegreeField] = useState(data.degreeField ?? '');
  const [ecaObtained, setEcaObtained] = useState<boolean | null>(data.ecaObtained);

  function handleEdit() {
    setEducationLevel(
      EDUCATION_OPTIONS.some((o) => o.value === data.educationLevel) ? data.educationLevel : null
    );
    setDegreeField(data.degreeField ?? '');
    setEcaObtained(data.ecaObtained);
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
        // Server action clears education_level_voice when education_level is present
        fields: {
          education_level: educationLevel as Parameters<typeof onSave>[0]['fields']['education_level'],
          degree_field: degreeField || null,
          eca_obtained: ecaObtained,
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
      title="Education"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Highest level"
        isEditing={isEditing}
        readContent={displayEnum(data.educationLevel, EDUCATION_OPTIONS)}
        editContent={<SelectInput value={educationLevel} onChange={setEducationLevel} options={EDUCATION_OPTIONS} />}
      />
      <FieldRow
        label="Field of study"
        isEditing={isEditing}
        readContent={displayValue(data.degreeField)}
        editContent={<TextInput value={degreeField} onChange={setDegreeField} />}
      />
      <FieldRow
        label="ECA obtained"
        isEditing={isEditing}
        readContent={displayBool(data.ecaObtained)}
        editContent={<BooleanSelect value={ecaObtained} onChange={setEcaObtained} />}
        isLast
      />
    </SectionCard>
  );
}
