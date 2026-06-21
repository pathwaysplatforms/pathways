'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, NumberInput, BooleanSelect, displayValue, displayBool } from './shared';
import type { SectionProps } from './shared';

/** Profile section: Work History (Canadian/foreign split, recency). */
export function WorkHistorySection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [canadianWorkYears, setCanadianWorkYears] = useState<number | null>(data.canadianWorkYears);
  const [foreignWorkYears, setForeignWorkYears] = useState<number | null>(data.foreignWorkYears);
  const [canadianWorkRecent, setCanadianWorkRecent] = useState<boolean | null>(data.canadianWorkRecent);
  const [foreignWorkRecent, setForeignWorkRecent] = useState<boolean | null>(data.foreignWorkRecent);

  function handleEdit() {
    setCanadianWorkYears(data.canadianWorkYears);
    setForeignWorkYears(data.foreignWorkYears);
    setCanadianWorkRecent(data.canadianWorkRecent);
    setForeignWorkRecent(data.foreignWorkRecent);
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
          canadian_work_years: canadianWorkYears,
          foreign_work_years: foreignWorkYears,
          canadian_work_recent: canadianWorkRecent,
          foreign_work_recent: foreignWorkRecent,
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
      title="Work History"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Canadian work (yrs)"
        isEditing={isEditing}
        readContent={displayValue(data.canadianWorkYears)}
        editContent={<NumberInput value={canadianWorkYears} onChange={setCanadianWorkYears} min={0} max={60} />}
      />
      <FieldRow
        label="Foreign work (yrs)"
        isEditing={isEditing}
        readContent={displayValue(data.foreignWorkYears)}
        editContent={<NumberInput value={foreignWorkYears} onChange={setForeignWorkYears} min={0} max={60} />}
      />
      <FieldRow
        label="Canadian work recent"
        isEditing={isEditing}
        readContent={displayBool(data.canadianWorkRecent)}
        editContent={<BooleanSelect value={canadianWorkRecent} onChange={setCanadianWorkRecent} />}
      />
      <FieldRow
        label="Foreign work recent"
        isEditing={isEditing}
        readContent={displayBool(data.foreignWorkRecent)}
        editContent={<BooleanSelect value={foreignWorkRecent} onChange={setForeignWorkRecent} />}
        isLast
      />
    </SectionCard>
  );
}
