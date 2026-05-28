'use client';

import { useState, useEffect } from 'react';
import type { ApplicationStep } from '@/modules/pathways/types';
import { DocumentUploadStep } from './steps/DocumentUploadStep';
import { InformationStep } from './steps/InformationStep';
import { ExternalActionStep } from './steps/ExternalActionStep';
import { ReviewStep } from './steps/ReviewStep';

interface Props {
  step: ApplicationStep;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  document_upload: 'Document Upload',
  information:     'Information',
  external_action: 'External Action',
  review:          'Review',
};

const CONTINUE_LABELS: Record<string, string> = {
  document_upload: 'Mark as Done & Continue →',
  information:     'Save & Continue →',
  external_action: "I've Done This — Continue →",
  review:          'Confirm & Submit →',
};

/** Left-column card rendering the current active step. */
export function StepCard({
  step,
  stepNumber,
  totalSteps,
  onNext,
  onBack,
  canGoBack,
  canGoNext,
}: Props) {
  const [isExternalConfirmed, setIsExternalConfirmed] = useState(false);

  // Reset confirmation when step changes
  useEffect(() => {
    setIsExternalConfirmed(false);
  }, [step.id]);

  const canContinue = step.type !== 'external_action' || isExternalConfirmed;
  const continueLabel = canGoNext
    ? (CONTINUE_LABELS[step.type] ?? 'Continue →')
    : 'Finish Application →';

  return (
    <div
      className="bg-bg-surface rounded-card border border-border-light"
      style={{ boxShadow: 'var(--shadow-card)', padding: '28px' }}
    >
      {/* Step badge row */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span
          className="bg-bg-subtle text-text-tertiary rounded-badge px-3 py-1"
          style={{ fontSize: '11px', fontWeight: 600 }}
        >
          Step {stepNumber} of {totalSteps}
        </span>
        <span className="label-eyebrow">{TYPE_LABELS[step.type]}</span>
        {step.is_optional && (
          <span className="label-eyebrow" style={{ color: 'var(--color-text-disabled)' }}>
            Optional
          </span>
        )}
      </div>

      {/* Title */}
      <h2
        className="text-text-primary font-bold leading-snug"
        style={{ fontSize: '22px', letterSpacing: '-0.01em' }}
      >
        {step.title}
      </h2>

      {/* Description */}
      <p className="text-text-secondary mt-2" style={{ fontSize: '14px', lineHeight: '1.65' }}>
        {step.description}
      </p>

      {/* Estimated duration */}
      {step.estimated_duration && (
        <p className="text-text-tertiary mt-1.5" style={{ fontSize: '12px' }}>
          Estimated time: {step.estimated_duration}
        </p>
      )}

      <div className="border-t border-border-light my-6" />

      {/* Step type content */}
      {step.type === 'document_upload' && step.document && (
        <DocumentUploadStep document={step.document} />
      )}
      {step.type === 'information' && <InformationStep step={step} />}
      {step.type === 'external_action' && (
        <ExternalActionStep
          step={step}
          isConfirmed={isExternalConfirmed}
          onConfirm={setIsExternalConfirmed}
        />
      )}
      {step.type === 'review' && <ReviewStep step={step} />}

      <div className="border-t border-border-light mt-6 mb-6" />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {canGoBack ? (
          <button
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary transition-colors"
            style={{ fontSize: '14px', fontWeight: 500 }}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={canContinue ? onNext : undefined}
          disabled={!canContinue}
          className={`btn-primary ${!canContinue ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ fontSize: '14px' }}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
