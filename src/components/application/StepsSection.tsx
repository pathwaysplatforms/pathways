'use client';

import React, { useState } from 'react';
import type { ApplicationStep } from '@/modules/dashboard/types';
import type { ApplicationDocument } from '@/modules/application/types';
import { updateStepProgress } from '@/app/actions/progress';

interface StepsSectionProps {
  steps: ApplicationStep[];
  documents: ApplicationDocument[];
  pathwaySlug: string;
}

type StepStatus = ApplicationStep['status'];

/** Derives the rendered status for a step given the current progress index. */
function resolveStatus(stepIndex: number, currentIdx: number): StepStatus {
  if (stepIndex < currentIdx) return 'complete';
  if (stepIndex === currentIdx) return 'current';
  return 'upcoming';
}

/** Understated outlined pill button shown in the row header for completed steps. */
function MarkIncompleteButton({ onClick }: { onClick: React.MouseEventHandler<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        fontFamily: 'var(--pw-font-body)',
        fontSize: 11,
        fontWeight: 500,
        color: '#9CA3AF',
        background: 'transparent',
        borderRadius: 9999,
        border: '1px solid #E5E5E5',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, color 150ms ease',
        whiteSpace: 'nowrap' as const,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#1A56DB';
        e.currentTarget.style.color = '#1A56DB';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E5E5E5';
        e.currentTarget.style.color = '#9CA3AF';
      }}
    >
      Mark as incomplete
    </button>
  );
}

/** Circle indicator with checkmark (complete), number+blue border (current), or number+gray border (upcoming). */
function StepCircle({ status, stepNumber }: { status: StepStatus; stepNumber: number }) {
  if (status === 'complete') {
    return (
      <div
        aria-label="Completed"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#1A56DB',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
          <path
            d="M1 4.5L4 7.5L10 1"
            stroke="white"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (status === 'current') {
    return (
      <div
        aria-label="In progress"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid #1A56DB',
          background: 'transparent',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 11,
            fontWeight: 500,
            color: '#1A56DB',
            lineHeight: 1,
          }}
        >
          {stepNumber}
        </span>
      </div>
    );
  }

  return (
    <div
      aria-label="Upcoming"
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '2px solid #E5E5E5',
        background: 'transparent',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 11,
          fontWeight: 500,
          color: '#9CA3AF',
          lineHeight: 1,
        }}
      >
        {stepNumber}
      </span>
    </div>
  );
}

/** Connector line between step circles. */
function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 1,
        flex: 1,
        minHeight: 12,
        background: isComplete ? '#1A56DB' : '#E5E5E5',
        margin: '3px auto',
        transition: 'background 300ms ease',
      }}
    />
  );
}

/** Expandable step list with document checklist and mark-complete action. */
export function StepsSection({ steps, documents, pathwaySlug }: StepsSectionProps) {
  const initialCurrentIdx = Math.max(
    0,
    steps.findIndex((s) => s.status === 'current')
  );
  const [currentIdx, setCurrentIdx] = useState(initialCurrentIdx);
  const [expandedId, setExpandedId] = useState<string | null>(
    steps[initialCurrentIdx]?.id ?? null
  );

  const allComplete = currentIdx >= steps.length;

  function handleToggle(stepId: string) {
    setExpandedId((prev) => (prev === stepId ? null : stepId));
  }

  function handleMarkComplete() {
    if (allComplete) return;
    const completingStep = steps[currentIdx];
    const nextIdx = currentIdx + 1;
    setCurrentIdx(nextIdx);
    const nextStep = steps[nextIdx];
    if (nextStep) setExpandedId(nextStep.id);

    // Persist: mark completing step complete, mark all after it upcoming.
    if (completingStep) {
      void updateStepProgress({ stepId: completingStep.id, pathwaySlug, status: 'complete' });
    }
    if (nextStep) {
      void updateStepProgress({ stepId: nextStep.id, pathwaySlug, status: 'current' });
    }
    for (let i = nextIdx + 1; i < steps.length; i++) {
      const s = steps[i];
      if (s) void updateStepProgress({ stepId: s.id, pathwaySlug, status: 'upcoming' });
    }
  }

  function handleMarkIncomplete(stepIndex: number) {
    const revertingStep = steps[stepIndex];
    setCurrentIdx(stepIndex);
    setExpandedId(steps[stepIndex]?.id ?? null);

    // Persist: mark this step current, mark all after it upcoming.
    if (revertingStep) {
      void updateStepProgress({ stepId: revertingStep.id, pathwaySlug, status: 'current' });
    }
    for (let i = stepIndex + 1; i < steps.length; i++) {
      const s = steps[i];
      if (s) void updateStepProgress({ stepId: s.id, pathwaySlug, status: 'upcoming' });
    }
  }

  if (steps.length === 0) {
    return (
      <div
        className="pw-entry pw-entry-delay-1"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E5',
          borderRadius: 12,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: '#6B7280',
          }}
        >
          Your pathway roadmap is being prepared.
        </p>
      </div>
    );
  }

  return (
    <div
      className="pw-entry pw-entry-delay-1"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: 12,
        padding: 28,
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <p className="pw-eyebrow" style={{ marginBottom: 4 }}>
          Your Roadmap
        </p>
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: '#6B7280',
            margin: 0,
          }}
        >
          {allComplete
            ? 'All steps complete — your application is in review.'
            : `${steps.length} step${steps.length !== 1 ? 's' : ''} to complete your application`}
        </p>
      </div>

      {/* Step rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((step, index) => {
          const status = resolveStatus(index, currentIdx);
          const isExpanded = expandedId === step.id;
          const isCurrentStep = status === 'current';
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* Circle + connector column */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  width: 28,
                }}
              >
                <StepCircle status={status} stepNumber={step.stepNumber} />
                {!isLast && <StepConnector isComplete={status === 'complete'} />}
              </div>

              {/* Row content */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingBottom: isLast ? 0 : 4,
                  borderLeft: isCurrentStep ? '2px solid #1A56DB' : '2px solid transparent',
                  paddingLeft: 10,
                  marginLeft: -10,
                  borderRadius: '0 8px 8px 0',
                  transition: 'border-left-color 250ms ease',
                }}
              >
                {/* Row header — always visible */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggle(step.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggle(step.id); }}
                  aria-expanded={isExpanded}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                    padding: '10px 0',
                    cursor: 'pointer',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--pw-font-body)',
                      fontSize: 14,
                      color: status === 'upcoming' ? '#9CA3AF' : '#0A0A0A',
                      margin: 0,
                      flex: 1,
                      lineHeight: 1.4,
                    }}
                  >
                    {step.label}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {step.estimatedDuration && (
                      <span
                        style={{
                          fontFamily: 'var(--pw-font-body)',
                          fontSize: 12,
                          color: '#9CA3AF',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        Est. {step.estimatedDuration}
                      </span>
                    )}
                    {status === 'complete' && (
                      <MarkIncompleteButton onClick={(e) => { e.stopPropagation(); handleMarkIncomplete(index); }} />
                    )}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                      style={{
                        transition: 'transform 250ms cubic-bezier(0.16,1,0.3,1)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        color: '#9CA3AF',
                      }}
                    >
                      <path
                        d="M2 4L6 8L10 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expandable content */}
                <div
                  style={{
                    maxHeight: isExpanded ? '600px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 300ms cubic-bezier(0.16,1,0.3,1)',
                  }}
                >
                  <div style={{ paddingBottom: 16 }}>
                    {/* Description */}
                    {step.description && (
                      <p
                        style={{
                          fontFamily: 'var(--pw-font-body)',
                          fontSize: 14,
                          color: '#374151',
                          marginBottom: documents.length > 0 ? 16 : 12,
                          lineHeight: 1.65,
                        }}
                      >
                        {step.description}
                      </p>
                    )}

                    {/* Documents */}
                    {documents.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p
                          style={{
                            fontFamily: 'var(--pw-font-body)',
                            fontSize: 11,
                            fontWeight: 500,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase' as const,
                            color: '#9CA3AF',
                            marginBottom: 8,
                          }}
                        >
                          Documents needed
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {documents.map((doc) => (
                            <li
                              key={doc.id}
                              style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 8,
                                marginBottom: 6,
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  fontFamily: 'var(--pw-font-body)',
                                  fontSize: 14,
                                  color: '#9CA3AF',
                                  flexShrink: 0,
                                }}
                              >
                                •
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--pw-font-body)',
                                  fontSize: 13,
                                  color: '#374151',
                                }}
                              >
                                {doc.name}
                                {!doc.isMandatory && (
                                  <span style={{ color: '#9CA3AF' }}> (optional)</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Mark as complete — only for current step */}
                    {isCurrentStep && !allComplete && (
                      <button
                        type="button"
                        onClick={handleMarkComplete}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 18px',
                          fontFamily: 'var(--pw-font-body)',
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#FFFFFF',
                          background: '#1A56DB',
                          borderRadius: 9999,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'opacity 150ms ease',
                        }}
                      >
                        Mark as complete →
                      </button>
                    )}

                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
