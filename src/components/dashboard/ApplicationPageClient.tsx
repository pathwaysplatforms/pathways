'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { updateStepProgress } from '@/app/actions/progress';
import { StepDetailDrawer } from '@/components/dashboard/StepDetailDrawer';
import { documentBelongsToStep } from '@/lib/step-document-map';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext } from '@/modules/dashboard/types';

export interface ApplicationPageClientProps {
  pathway: {
    title: string;
    officialName: string;
    slug: string;
    processingTime: string;
    totalSteps: number;
    description: string;
  };
  steps: EnrichedApplicationStep[];
  profileContext: ProfileContext | null;
  documents: DashboardDocument[];
}

const ink = '#0A0A0A';
const muted = '#6B7280';
const border = '#E5E5E5';
const accent = '#1A56DB';
const font = {
  body: 'var(--pw-font-body)' as const,
  display: 'var(--pw-font-display)' as const,
};

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: font.body,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.12em',
      color: '#9CA3AF',
      textTransform: 'uppercase',
      margin: '0 0 12px',
    }}>
      {children}
    </p>
  );
}

function ColumnLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: font.body,
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: '0.1em',
      color: '#9CA3AF',
      textTransform: 'uppercase',
      margin: '0 0 4px',
    }}>
      {children}
    </p>
  );
}

type StepStatus = 'complete' | 'current' | 'upcoming';

function StepCircle({ status, stepNumber }: { status: StepStatus; stepNumber: number }) {
  if (status === 'complete') {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: accent, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
          <path d="M1 4.5L4.5 8L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: `2px solid ${accent}`,
        background: 'transparent', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, fontFamily: font.body, fontSize: 12,
      }}>
        {stepNumber}
      </div>
    );
  }
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      border: '1.5px solid #E5E5E5',
      background: 'transparent', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9CA3AF', fontFamily: font.body, fontSize: 12,
    }}>
      {stepNumber}
    </div>
  );
}

interface StepRowProps {
  step: EnrichedApplicationStep;
  isExpanded: boolean;
  pathwaySlug: string;
  documents: DashboardDocument[];
  onToggle: () => void;
  onViewDetails: () => void;
  onMarkComplete: (stepId: string) => void;
  locallyCompleted: boolean;
}

/** Single accordion row in the step list. */
function StepRow({
  step,
  isExpanded,
  pathwaySlug,
  documents,
  onToggle,
  onViewDetails,
  onMarkComplete,
  locallyCompleted,
}: StepRowProps) {
  const [isPending, startTransition] = useTransition();
  const displayStatus: StepStatus = locallyCompleted ? 'complete' : step.status;
  const textColor = displayStatus === 'upcoming' ? '#9CA3AF' : ink;

  const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));
  const hasDocuments = stepDocs.length > 0;

  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
      onMarkComplete(step.id);
    });
  };

  return (
    <div style={{ borderBottom: `1px solid ${border}` }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 0', cursor: 'pointer',
        }}
      >
        <StepCircle status={displayStatus} stepNumber={step.stepNumber} />
        <p style={{
          fontFamily: font.body, fontSize: 14, color: textColor,
          margin: 0, flex: 1, minWidth: 0,
        }}>
          {step.label}
        </p>
        {step.estimatedDuration && (
          <span style={{
            fontFamily: font.body, fontSize: 12, color: muted,
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            {step.estimatedDuration}
          </span>
        )}
        <ChevronDown
          size={16}
          color={muted}
          style={{
            flexShrink: 0,
            transition: 'transform 200ms ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>

      <div style={{
        maxHeight: isExpanded ? 600 : 0,
        overflow: 'hidden',
        transition: 'max-height 300ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          background: '#FAFAF9',
          borderTop: `1px solid #F3F4F6`,
          padding: '14px 0 16px',
          marginLeft: 40,
        }}>
          {step.description && (
            <p style={{
              fontFamily: font.body, fontSize: 13, color: '#374151',
              margin: '0 0 14px', lineHeight: 1.6,
            }}>
              {step.description}
            </p>
          )}

          {hasDocuments && (
            <div style={{ marginBottom: 14 }}>
              <p style={{
                fontFamily: font.body, fontSize: 10, fontWeight: 500,
                letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase',
                margin: '0 0 8px',
              }}>
                Documents Needed
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {stepDocs.map((doc) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: doc.isMandatory ? ink : 'transparent',
                      border: doc.isMandatory ? 'none' : `1.5px solid ${muted}`,
                      display: 'inline-block',
                    }} />
                    <span style={{ fontFamily: font.body, fontSize: 12, color: ink }}>
                      {doc.name}
                      {!doc.isMandatory && (
                        <span style={{ color: muted, marginLeft: 4 }}>(optional)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
              style={{
                fontFamily: font.body, fontSize: 13, color: accent,
                background: 'none', border: 'none', padding: 0,
                cursor: 'pointer',
              }}
            >
              View details →
            </button>

            {locallyCompleted ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 9999,
                background: '#F0FDF4', color: '#16A34A',
                fontFamily: font.body, fontSize: 12, fontWeight: 500,
              }}>
                ✓ Completed
              </span>
            ) : (
              <button
                onClick={handleMarkComplete}
                disabled={isPending}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 9999,
                  background: isPending ? '#E5E7EB' : ink,
                  color: isPending ? muted : '#FFFFFF',
                  fontFamily: font.body, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? 'Saving...' : 'Mark as complete →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Owned application page — pathway header, interactive step list, and step detail drawer. */
export function ApplicationPageClient({
  pathway,
  steps,
  profileContext,
  documents,
}: ApplicationPageClientProps) {
  const firstActivStep = steps.find((s) => s.status !== 'complete') ?? null;
  const [expandedStepId, setExpandedStepId] = useState<string | null>(
    firstActivStep?.id ?? null
  );
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(steps.filter((s) => s.status === 'complete').map((s) => s.id))
  );
  const [drawerStep, setDrawerStep] = useState<EnrichedApplicationStep | null>(null);

  const handleToggle = (stepId: string) => {
    setExpandedStepId((prev) => (prev === stepId ? null : stepId));
  };

  const handleMarkComplete = (stepId: string) => {
    setCompletedIds((prev) => new Set([...prev, stepId]));
  };

  return (
    <>
      <div style={{ maxWidth: 768, margin: '0 auto', padding: '32px 24px' }}>

        {/* Pathway header card */}
        <div style={{
          background: '#FFFFFF',
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <MetaLabel>Your Pathway</MetaLabel>
          <h1 style={{
            fontFamily: font.display, fontSize: 28, fontWeight: 400,
            color: ink, margin: '0 0 4px', lineHeight: 1.2,
          }}>
            {pathway.title}
          </h1>
          {pathway.officialName && (
            <p style={{ fontFamily: font.body, fontSize: 13, color: muted, margin: '0 0 4px' }}>
              {pathway.officialName}
            </p>
          )}
          <hr style={{ border: 'none', borderTop: `1px solid ${border}`, margin: '16px 0' }} />
          <div style={{ display: 'flex', gap: 32, marginBottom: pathway.description ? 16 : 0 }}>
            <div>
              <ColumnLabel>Processing Time</ColumnLabel>
              <p style={{ fontFamily: font.body, fontSize: 14, color: ink, margin: 0 }}>
                {pathway.processingTime}
              </p>
            </div>
            <div>
              <ColumnLabel>Total Steps</ColumnLabel>
              <p style={{ fontFamily: font.body, fontSize: 14, color: ink, margin: 0 }}>
                {pathway.totalSteps}
              </p>
            </div>
          </div>
          {pathway.description && (
            <p style={{
              fontFamily: font.body, fontSize: 14, color: '#374151',
              margin: '0 0 16px', lineHeight: 1.6,
            }}>
              {pathway.description}
            </p>
          )}
          <div style={{ textAlign: 'right' }}>
            <Link
              href="/onboarding/matches"
              style={{ fontFamily: font.body, fontSize: 13, color: accent, textDecoration: 'none' }}
            >
              Change pathway →
            </Link>
          </div>
        </div>

        {/* Step list */}
        <div style={{
          background: '#FFFFFF',
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <MetaLabel>Your Roadmap</MetaLabel>
          <p style={{ fontFamily: font.body, fontSize: 13, color: muted, margin: '0 0 20px' }}>
            {pathway.totalSteps} steps to complete your application
          </p>
          <div>
            {steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                isExpanded={expandedStepId === step.id}
                locallyCompleted={completedIds.has(step.id)}
                pathwaySlug={pathway.slug}
                documents={documents}
                onToggle={() => handleToggle(step.id)}
                onViewDetails={() => setDrawerStep(step)}
                onMarkComplete={handleMarkComplete}
              />
            ))}
          </div>
        </div>
      </div>

      {drawerStep !== null && (
        <StepDetailDrawer
          step={drawerStep}
          documents={documents}
          pathwaySlug={pathway.slug}
          applicationId={null}
          profileContext={profileContext}
          onClose={() => setDrawerStep(null)}
        />
      )}
    </>
  );
}
