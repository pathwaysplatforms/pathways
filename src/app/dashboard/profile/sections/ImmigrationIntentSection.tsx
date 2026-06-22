'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, TextInput, BooleanSelect, displayValue, displayBool } from './shared';
import type { SectionProps } from './shared';

/** Profile section: Immigration Intent (province, family in Canada). */
export function ImmigrationIntentSection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [intendedProvince, setIntendedProvince] = useState(data.intendedProvince ?? '');
  const [hasFamilyInCanada, setHasFamilyInCanada] = useState<boolean | null>(data.hasFamilyInCanada);

  function handleEdit() {
    setIntendedProvince(data.intendedProvince ?? '');
    setHasFamilyInCanada(data.hasFamilyInCanada);
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
          intended_province: intendedProvince || null,
          has_family_in_canada: hasFamilyInCanada,
        },
        recalculate: false,
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
      title="Immigration Intent"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Intended province"
        isEditing={isEditing}
        readContent={displayValue(data.intendedProvince)}
        editContent={<TextInput value={intendedProvince} onChange={setIntendedProvince} />}
      />
      <FieldRow
        label="Family in Canada"
        isEditing={isEditing}
        readContent={displayBool(data.hasFamilyInCanada)}
        editContent={<BooleanSelect value={hasFamilyInCanada} onChange={setHasFamilyInCanada} />}
        isLast
      />
    </SectionCard>
  );
}
