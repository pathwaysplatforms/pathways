'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { StepDetailDrawer } from './StepDetailDrawer';
import {
  DocumentsSection,
  ResourcesSection,
  EmailTemplatesSection,
  CoverLetterSection,
  SectionLabel,
  SectionDivider,
} from './StepDetailDrawer';
import { documentBelongsToStep } from '@/lib/step-document-map';
import { getEmailTemplates } from '@/lib/email-templates';
import { updateStepProgress } from '@/app/actions/progress';
import { useScrollFade } from '@/hooks/useScrollFade';
import { DashboardDataProvider } from '@/contexts/DashboardDataContext';
import { CheckmarkDraw } from '@/components/fx/CheckmarkDraw';
import { ParticleBurst } from '@/components/fx/ParticleBurst';
import type {
  DashboardData,
  EnrichedApplicationStep,
  DashboardDocument,
  ProfileContext,
} from '@/modules/dashboard/types';

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  ink:        'var(--pw-ink)',
  muted:      'var(--pw-muted)',
  accent:     'var(--pw-accent)',
  surface:    'var(--pw-surface)',
  fontDisplay:'var(--pw-font-display)',
  fontBody:   'var(--pw-font-body)',
  fontUi:     'var(--pw-font-ui)',
} as const;

// ── Stepper dot ──────────────────────────────────────────────────────────────

function StepDot({ status }: { status: EnrichedApplicationStep['status'] }) {
  if (status === 'complete') {
    return (
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: C.accent, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="6" height="5" viewBox="0 0 6 5" fill="none" aria-hidden="true">
          <path d="M1 2.5L2.5 4L5 1" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        border: `2px solid ${C.accent}`,
        background: 'transparent', flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: 10, height: 10, borderRadius: '50%',
      border: '1.5px solid #D1D5DB',
      background: 'transparent', flexShrink: 0,
    }} />
  );
}

// ── Pathway stepper ──────────────────────────────────────────────────────────

interface StepperProps {
  steps: EnrichedApplicationStep[];
  pathwayTitle: string | null;
  processingTime: string | null;
  onStepClick: (step: EnrichedApplicationStep) => void;
}

/**
 * Vertical dot-and-connector stepper.
 * Pathway title is pinned at the top; the step list scrolls internally at xl.
 */
function PathwayStepper({ steps, pathwayTitle, processingTime, onStepClick }: StepperProps) {
  const { ref: scrollRef, faded } = useScrollFade();
  if (steps.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontFamily: C.fontBody, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          Select a pathway to see your step-by-step roadmap.
        </p>
        <Link
          href="/pathways"
          style={{ fontFamily: C.fontBody, fontSize: 13, color: C.accent, textDecoration: 'none' }}
        >
          Browse pathways →
        </Link>
      </div>
    );
  }

  return (
    <div className="pw-scroll-fade" data-faded={faded} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Fixed pathway header */}
      {pathwayTitle && (
        <div style={{ flexShrink: 0, marginBottom: 20 }}>
          <p style={{
            fontFamily: C.fontUi, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: C.muted, marginBottom: 4,
          }}>
            Your Pathway
          </p>
          <p style={{
            fontFamily: C.fontDisplay, fontSize: 18, fontWeight: 400,
            color: C.ink, lineHeight: 1.2, margin: 0,
          }}>
            {pathwayTitle}
          </p>
          {processingTime && (
            <p style={{ fontFamily: C.fontBody, fontSize: 12, color: C.muted, marginTop: 3 }}>
              Est. {processingTime}
            </p>
          )}
        </div>
      )}

      {/* Scrollable step list */}
      <div ref={scrollRef} className="pw-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const isCurrent = step.status === 'current';
          const isClickable = !isCurrent;

          return (
            <div key={step.id} style={{ display: 'flex', gap: 10 }}>
              {/* Dot + connector */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: 10, flexShrink: 0, paddingTop: 3,
              }}>
                <StepDot status={step.status} />
                {!isLast && (
                  <div style={{
                    width: 1.5, flex: 1, minHeight: 12,
                    background: step.status === 'complete' ? C.accent : '#E5E5E5',
                    marginTop: 3,
                    opacity: step.status === 'complete' ? 0.35 : 1,
                  }} />
                )}
              </div>

              {/* Label row */}
              <div
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={isClickable ? `Open details for step ${step.stepNumber}: ${step.label}` : undefined}
                onClick={isClickable ? () => onStepClick(step) : undefined}
                onKeyDown={isClickable
                  ? (e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(step); }
                  : undefined}
                style={{
                  flex: 1,
                  paddingBottom: isLast ? 0 : 14,
                  borderLeft: isCurrent ? `2px solid ${C.accent}` : '2px solid transparent',
                  marginLeft: -2,
                  paddingLeft: 8,
                  cursor: isClickable ? 'pointer' : 'default',
                  borderRadius: 4,
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={isClickable
                  ? (e) => { (e.currentTarget as HTMLDivElement).style.background = '#F5F6F8'; }
                  : undefined}
                onMouseLeave={isClickable
                  ? (e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }
                  : undefined}
              >
                <p style={{
                  fontFamily: C.fontBody,
                  fontSize: 13,
                  fontWeight: isCurrent ? 500 : 400,
                  color: step.status === 'upcoming' ? '#9CA3AF' : C.ink,
                  lineHeight: 1.3,
                  margin: 0,
                }}>
                  {step.label}
                </p>
                {isCurrent && step.estimatedDuration && (
                  <p style={{
                    fontFamily: C.fontBody, fontSize: 11, color: C.muted,
                    marginTop: 2, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Clock size={10} aria-hidden="true" />
                    {step.estimatedDuration}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Empty center card ────────────────────────────────────────────────────────

interface EmptyStepCardProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

/** Center card shown when no current step exists (state-appropriate CTA). */
function EmptyStepCard({ title, body, ctaLabel, ctaHref }: EmptyStepCardProps) {
  return (
    <div
      className="xl:flex-1"
      style={{
        background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16, padding: '28px 24px',
      }}
    >
      <h2 style={{
        fontFamily: C.fontDisplay, fontSize: 20, fontWeight: 400,
        color: C.ink, lineHeight: 1.2, margin: '0 0 10px',
      }}>
        {title}
      </h2>
      <p style={{
        fontFamily: C.fontBody, fontSize: 14, color: C.muted,
        lineHeight: 1.65, margin: '0 0 20px',
      }}>
        {body}
      </p>
      <Link
        href={ctaHref}
        style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '8px 18px', borderRadius: 9999,
          background: C.ink, color: '#FFFFFF',
          fontFamily: C.fontUi, fontSize: 13, fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        {ctaLabel} →
      </Link>
    </div>
  );
}

// ── Current step card ────────────────────────────────────────────────────────

interface CurrentStepCardProps {
  step: EnrichedApplicationStep | null;
  documents: DashboardDocument[];
  pathwaySlug: string | null;
  profileContext: ProfileContext;
  state: DashboardData['state'];
  applicationId: string | null;
}

/** Inline center card. Header and footer are pinned; content scrolls internally at xl. */
function CurrentStepCard({
  step,
  documents,
  pathwaySlug,
  profileContext,
  state,
  applicationId,
}: CurrentStepCardProps) {
  const router = useRouter();
  const { ref: scrollRef, faded } = useScrollFade();
  const [markedComplete, setMarkedComplete] = useState(step?.status === 'complete');
  const [justCompleted, setJustCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMarkedComplete(step?.status === 'complete');
    setJustCompleted(false);
    setActionError(null);
  }, [step?.id, step?.status]);

  const handleMarkComplete = () => {
    if (!step || !pathwaySlug) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
        setMarkedComplete(true);
        setJustCompleted(true);
        setTimeout(() => { router.refresh(); }, 1200);
      } catch {
        setActionError('Failed to save. Please try again.');
      }
    });
  };

  if (!step) {
    if (state === 'onboarding_incomplete') {
      return (
        <EmptyStepCard
          title="Finish your profile"
          body="Complete your immigration profile to get matched to a pathway and unlock your step-by-step roadmap."
          ctaLabel="Continue profile"
          ctaHref="/onboarding/review"
        />
      );
    }
    if (state === 'pathway_not_selected') {
      return (
        <EmptyStepCard
          title="Select your pathway"
          body="Browse Express Entry pathways and choose the one that matches your profile. Your roadmap will appear here."
          ctaLabel="Browse pathways"
          ctaHref="/pathways"
        />
      );
    }
    if (state === 'application_submitted') {
      return (
        <EmptyStepCard
          title="Application submitted"
          body="Your application is under review. We'll update your status as the process progresses. No further action required at this time."
          ctaLabel="View application"
          ctaHref={applicationId ? `/applications/${applicationId}` : '/dashboard/application'}
        />
      );
    }
    return (
      <EmptyStepCard
        title="Roadmap loading"
        body="Your step-by-step roadmap is being prepared based on your pathway selection."
        ctaLabel="View application"
        ctaHref="/dashboard/application"
      />
    );
  }

  const stepDocs = documents.filter((d) => documentBelongsToStep(d.name, step.stepNumber));
  const hasDocuments = stepDocs.length > 0;
  const hasResources = (step.resources?.length ?? 0) > 0;
  const templates = pathwaySlug ? getEmailTemplates(pathwaySlug, step.stepNumber) : [];
  const hasTemplates = templates.length > 0;
  const showCoverLetter = step.stepNumber >= 3 && step.stepNumber <= 5;
  const hasContent = hasDocuments || hasResources || hasTemplates || showCoverLetter;

  return (
    <div
      className="xl:flex-1 xl:flex xl:flex-col xl:overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
      }}
    >
      {/* Header — fixed */}
      <div style={{
        padding: '24px 24px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(0,0,0,0.06)',
            fontFamily: C.fontUi, fontSize: 10, fontWeight: 500, color: C.muted,
            flexShrink: 0,
          }}>
            {step.stepNumber}
          </span>
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 9999,
            background: markedComplete ? '#F0FDF4' : '#EFF6FF',
            color: markedComplete ? '#16A34A' : C.accent,
            fontFamily: C.fontUi, fontSize: 10, fontWeight: 500,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            {markedComplete ? 'Complete' : 'In Progress'}
          </span>
          {step.estimatedDuration && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: C.fontBody, fontSize: 12, color: C.muted,
            }}>
              <Clock size={12} aria-hidden="true" />
              {step.estimatedDuration}
            </span>
          )}
        </div>
        <h2 style={{
          fontFamily: C.fontDisplay, fontSize: 20, fontWeight: 400,
          color: C.ink, lineHeight: 1.2, margin: 0,
        }}>
          {step.label}
        </h2>
        {step.description && (
          <p style={{
            fontFamily: C.fontBody, fontSize: 13, color: '#374151',
            marginTop: 8, lineHeight: 1.65,
          }}>
            {step.description}
          </p>
        )}
      </div>

      {/* Content — scrollable at xl */}
      <div className="pw-scroll-fade xl:flex-1 xl:min-h-0 flex flex-col" data-faded={faded}>
      <div
        ref={scrollRef}
        className="pw-scroll xl:flex-1 xl:min-h-0 xl:overflow-y-auto"
        style={{ padding: '0 24px' }}
      >
        {hasDocuments && (
          <div style={{ paddingTop: 18, paddingBottom: 14 }}>
            <SectionLabel>Documents Needed</SectionLabel>
            <DocumentsSection stepDocs={stepDocs} />
            <SectionDivider />
          </div>
        )}

        {hasResources && step.resources && (
          <div style={{ paddingTop: 18, paddingBottom: 14 }}>
            <SectionLabel>Official Resources</SectionLabel>
            <ResourcesSection resources={step.resources} />
            <SectionDivider />
          </div>
        )}

        {hasTemplates && pathwaySlug && (
          <div style={{ paddingTop: 18, paddingBottom: 14 }}>
            <SectionLabel>Email Templates</SectionLabel>
            <EmailTemplatesSection
              pathwaySlug={pathwaySlug}
              stepNumber={step.stepNumber}
              profileContext={profileContext}
            />
            <SectionDivider />
          </div>
        )}

        {showCoverLetter && (
          <div style={{ paddingTop: 18, paddingBottom: 14 }}>
            <SectionLabel>Cover Letter</SectionLabel>
            <CoverLetterSection step={step} pathwaySlug={pathwaySlug} />
          </div>
        )}

        {!hasContent && (
          <div style={{ padding: '18px 0' }}>
            <p style={{ fontFamily: C.fontBody, fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
              Detailed guidance for this step will appear here.
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Footer — fixed */}
      <div style={{
        padding: '12px 24px',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}>
        {actionError && (
          <p style={{
            fontFamily: C.fontBody, fontSize: 12, color: '#DC2626',
            marginBottom: 8,
          }}>
            {actionError}
          </p>
        )}
        {markedComplete ? (
          <div style={{
            position: 'relative',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 9999,
            background: '#F0FDF4', color: '#16A34A',
            fontFamily: C.fontUi, fontSize: 13, fontWeight: 500,
          }}>
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              {justCompleted ? (
                <>
                  <CheckmarkDraw size={14} color="#0D0D0D" />
                  <ParticleBurst count={12} size={64} />
                </>
              ) : (
                <Check size={14} />
              )}
            </span>
            Completed
          </div>
        ) : (
          <button
            onClick={handleMarkComplete}
            disabled={isPending || !pathwaySlug}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', borderRadius: 9999,
              background: isPending || !pathwaySlug ? '#E5E7EB' : C.ink,
              color: isPending || !pathwaySlug ? C.muted : '#FFFFFF',
              fontFamily: C.fontUi, fontSize: 13, fontWeight: 500,
              border: 'none',
              cursor: isPending || !pathwaySlug ? 'not-allowed' : 'pointer',
              transition: 'opacity 100ms ease',
            }}
          >
            {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {isPending ? 'Saving...' : 'Mark as complete →'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main layout ──────────────────────────────────────────────────────────────

interface DashboardHomeLayoutProps {
  data: DashboardData;
}

/** Stepper-anchored 2-column layout. Fills its parent flex container at xl. */
export function DashboardHomeLayout({ data }: DashboardHomeLayoutProps) {
  const [selectedStep, setSelectedStep] = useState<EnrichedApplicationStep | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const steps: EnrichedApplicationStep[] =
    data.selectedPathwaySteps.length > 0
      ? data.selectedPathwaySteps
      : data.applicationSteps.map((s) => ({ ...s }));

  const currentStep = steps.find((s) => s.status === 'current') ?? null;
  const pathwaySlug = data.selectedPathwaySlug ?? data.applicationPathwaySlug;

  const pathwayTitle = data.selectedPathwayTitle ?? data.pathwayTitle ?? null;
  const processingTime =
    data.selectedPathwayProcessingTime ??
    (data.processingTimeMin && data.processingTimeMax
      ? `${data.processingTimeMin}–${data.processingTimeMax}`
      : null);

  const entryVis = isVisible ? ' is-visible' : '';

  const handleDrawerClose = () => {
    setSelectedStep(null);
    router.refresh();
  };

  return (
    <DashboardDataProvider data={data}>
      {/*
        Flex-fill wrapper: takes all available height from page.tsx's flex column.
        On xl, the 2-column row fills the viewport height.
      */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* 2-column content row
            xl: fills remaining height, overflow hidden (each column scrolls internally)
            md: natural height, row direction, page scrolls
            mobile: natural height, stacked, page scrolls
        */}
        <div
          className={`pw-entry flex flex-col md:flex-row items-start xl:flex-1 xl:min-h-0 xl:overflow-hidden xl:items-stretch${entryVis}`}
          style={{ gap: 32, transitionDelay: '120ms' }}
        >
          {/* Left: stepper card (~25% at xl) */}
          <div className="w-full md:w-2/5 xl:w-1/4 md:flex-shrink-0 flex flex-col xl:overflow-hidden">
            {/* Stepper card — flex-fills the column at xl */}
            <div
              className="xl:flex-1 xl:min-h-0 xl:flex xl:flex-col xl:overflow-hidden"
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: '24px',
                boxShadow: 'var(--shadow-card-md)',
              }}
            >
              <PathwayStepper
                steps={steps}
                pathwayTitle={pathwayTitle}
                processingTime={processingTime}
                onStepClick={setSelectedStep}
              />
            </div>
          </div>

          {/* Center: current step inline card (flex-1, ~75% at xl) */}
          <div className="flex-1 min-w-0 w-full xl:flex xl:flex-col xl:min-h-0 xl:overflow-hidden">
            <CurrentStepCard
              step={currentStep}
              documents={data.documents}
              pathwaySlug={pathwaySlug}
              profileContext={data.profileContext}
              state={data.state}
              applicationId={data.applicationId}
            />
          </div>
        </div>
      </div>

      {/* Step detail drawer (triggered by non-current step clicks) */}
      {selectedStep !== null && (
        <StepDetailDrawer
          step={selectedStep}
          documents={data.documents}
          pathwaySlug={pathwaySlug}
          applicationId={data.applicationId}
          profileContext={data.profileContext}
          onClose={handleDrawerClose}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </DashboardDataProvider>
  );
}
