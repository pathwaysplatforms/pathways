'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, NumberInput, displayValue } from './shared';
import type { SectionProps } from './shared';

/** Profile section: Language scores (proficiency level + CLB scores). */
export function LanguageSection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [clbListening, setClbListening] = useState<number | null>(data.clbListening);
  const [clbReading, setClbReading] = useState<number | null>(data.clbReading);
  const [clbSpeaking, setClbSpeaking] = useState<number | null>(data.clbSpeaking);
  const [clbWriting, setClbWriting] = useState<number | null>(data.clbWriting);

  function handleEdit() {
    setClbListening(data.clbListening);
    setClbReading(data.clbReading);
    setClbSpeaking(data.clbSpeaking);
    setClbWriting(data.clbWriting);
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
          clb_listening: clbListening,
          clb_reading: clbReading,
          clb_speaking: clbSpeaking,
          clb_writing: clbWriting,
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
      title="Language Scores"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Proficiency level"
        isEditing={false}
        readContent={displayValue(data.englishLevel)}
      />
      <FieldRow
        label="CLB Listening"
        isEditing={isEditing}
        readContent={displayValue(data.clbListening)}
        editContent={<NumberInput value={clbListening} onChange={setClbListening} min={0} max={12} />}
      />
      <FieldRow
        label="CLB Reading"
        isEditing={isEditing}
        readContent={displayValue(data.clbReading)}
        editContent={<NumberInput value={clbReading} onChange={setClbReading} min={0} max={12} />}
      />
      <FieldRow
        label="CLB Speaking"
        isEditing={isEditing}
        readContent={displayValue(data.clbSpeaking)}
        editContent={<NumberInput value={clbSpeaking} onChange={setClbSpeaking} min={0} max={12} />}
      />
      <FieldRow
        label="CLB Writing"
        isEditing={isEditing}
        readContent={displayValue(data.clbWriting)}
        editContent={<NumberInput value={clbWriting} onChange={setClbWriting} min={0} max={12} />}
        isLast
      />
    </SectionCard>
  );
}
