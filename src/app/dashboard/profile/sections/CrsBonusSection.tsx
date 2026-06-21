'use client';

import { useState } from 'react';
import { SectionCard, FieldRow, BooleanSelect, displayBool } from './shared';
import type { SectionProps } from './shared';

/** Profile section: CRS Bonus Factors (nomination, job offer, sibling). */
export function CrsBonusSection({ data, onSave }: SectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [hasProvincialNomination, setHasProvincialNomination] = useState<boolean | null>(data.hasProvincialNomination);
  const [hasCanadianJobOffer, setHasCanadianJobOffer] = useState<boolean | null>(data.hasCanadianJobOffer);
  const [hasSiblingInCanada, setHasSiblingInCanada] = useState<boolean | null>(data.hasSiblingInCanada);

  function handleEdit() {
    setHasProvincialNomination(data.hasProvincialNomination);
    setHasCanadianJobOffer(data.hasCanadianJobOffer);
    setHasSiblingInCanada(data.hasSiblingInCanada);
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
          has_provincial_nomination: hasProvincialNomination,
          has_canadian_job_offer: hasCanadianJobOffer,
          has_sibling_in_canada: hasSiblingInCanada,
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
      title="CRS Bonus Factors"
      isEditing={isEditing}
      isSaving={isSaving}
      saveError={saveError}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <FieldRow
        label="Provincial nomination"
        isEditing={isEditing}
        readContent={displayBool(data.hasProvincialNomination)}
        editContent={<BooleanSelect value={hasProvincialNomination} onChange={setHasProvincialNomination} />}
      />
      <FieldRow
        label="Canadian job offer"
        isEditing={isEditing}
        readContent={displayBool(data.hasCanadianJobOffer)}
        editContent={<BooleanSelect value={hasCanadianJobOffer} onChange={setHasCanadianJobOffer} />}
      />
      <FieldRow
        label="Sibling in Canada"
        isEditing={isEditing}
        readContent={displayBool(data.hasSiblingInCanada)}
        editContent={<BooleanSelect value={hasSiblingInCanada} onChange={setHasSiblingInCanada} />}
        isLast
      />
    </SectionCard>
  );
}
