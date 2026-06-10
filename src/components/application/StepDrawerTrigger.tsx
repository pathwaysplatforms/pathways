'use client';

import { useState } from 'react';
import { StepDetailDrawer } from '@/components/dashboard/StepDetailDrawer';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext } from '@/modules/dashboard/types';

const ink = '#0A0A0A';
const font = { body: 'var(--pw-font-body)' as const };

interface StepDrawerTriggerProps {
  currentStep: EnrichedApplicationStep | null;
  steps: EnrichedApplicationStep[];
  documents: DashboardDocument[];
  pathwaySlug: string;
  profileContext: ProfileContext;
}

/**
 * Floating "Step details" button fixed to the bottom-right of the viewport.
 * Renders only when there is an active (current) step; opens StepDetailDrawer for that step.
 */
export function StepDrawerTrigger({
  currentStep,
  steps,
  documents,
  pathwaySlug,
  profileContext,
}: StepDrawerTriggerProps) {
  const [selectedStep, setSelectedStep] = useState<EnrichedApplicationStep | null>(null);

  const activeStep = selectedStep ?? currentStep;

  if (!currentStep) return null;

  return (
    <>
      {/* Floating trigger */}
      <div style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}>
        {/* Step picker — small chips for each step */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'flex-end',
        }}>
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStep(s)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 12px',
                borderRadius: 9999,
                border: '1px solid #E5E5E5',
                background: s.status === 'current' ? ink : '#FFFFFF',
                color: s.status === 'current' ? '#FFFFFF' : '#6B7280',
                fontFamily: font.body,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (s.status !== 'current') (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = s.status === 'current' ? ink : '#FFFFFF';
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 16, height: 16, borderRadius: '50%',
                background: s.status === 'current' ? 'rgba(255,255,255,0.2)' : '#F3F4F6',
                fontSize: 9, fontWeight: 600,
                color: s.status === 'current' ? '#FFFFFF' : '#6B7280',
                flexShrink: 0,
              }}>
                {s.stepNumber}
              </span>
              {s.label}
              <span style={{ opacity: 0.6, fontSize: 11 }}>→</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drawer */}
      {activeStep && (
        <StepDetailDrawer
          step={activeStep}
          documents={documents}
          pathwaySlug={pathwaySlug}
          applicationId={null}
          profileContext={profileContext}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </>
  );
}
