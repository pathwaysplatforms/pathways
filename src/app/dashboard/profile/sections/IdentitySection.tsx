'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, TextInput, displayValue } from './shared';
import type { SectionProps } from './shared';

function formatMaritalStatus(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Profile section: Identity (name, nationality, country, date of birth, marital status). */
export function IdentitySection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(data.fullName ?? '');
  const [nationality, setNationality] = useState(data.nationality ?? '');
  const [currentCountry, setCurrentCountry] = useState(data.currentCountry ?? '');

  function handleEdit() {
    setFullName(data.fullName ?? '');
    setNationality(data.nationality ?? '');
    setCurrentCountry(data.currentCountry ?? '');
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
          full_name: fullName || null,
          nationality: nationality || null,
          current_country: currentCountry || null,
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
      title="Identity"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Full name"
        isEditing={isEditing}
        readContent={displayValue(data.fullName)}
        editContent={<TextInput value={fullName} onChange={setFullName} />}
      />
      <FieldRow
        label="Nationality"
        isEditing={isEditing}
        readContent={displayValue(data.nationality)}
        editContent={<TextInput value={nationality} onChange={setNationality} />}
      />
      <FieldRow
        label="Current country"
        isEditing={isEditing}
        readContent={displayValue(data.currentCountry)}
        editContent={<TextInput value={currentCountry} onChange={setCurrentCountry} />}
      />
      <FieldRow
        label="Date of birth"
        isEditing={false}
        readContent={displayValue(data.dateOfBirth)}
      />
      <FieldRow
        label="Marital status"
        isEditing={false}
        readContent={displayValue(formatMaritalStatus(data.maritalStatus))}
        isLast
      />
    </SectionCard>
  );
}
