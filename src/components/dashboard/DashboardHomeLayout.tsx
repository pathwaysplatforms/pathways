'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/fx/AnimatedNumber';
import { GreetingHeader } from './GreetingHeader';
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

// Profile completeness below this value triggers the accuracy warning.
const COMPLETENESS_WARNING_THRESHOLD = 75;

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
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

// ── Combined CRS + profile widget ────────────────────────────────────────────

interface CrsProfileWidgetProps {
  crsValue: string;
  completeness: number;
}

/**
 * Single right-column card: large CRS score linking to /dashboard/crs,
 * plus a conditional completeness state (warning vs quiet link).
 * Amber warning tokens match the existing usage in dashboard/crs/page.tsx.
 */
function CrsProfileWidget({ crsValue, completeness }: CrsProfileWidgetProps) {
  const clamped = Math.max(0, Math.min(100, completeness));
  const isLowCompleteness = completeness < COMPLETENESS_WARNING_THRESHOLD;
  const barColor = clamped === 100 ? '#16A34A' : C.accent;

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      boxShadow: 'var(--shadow-card-md)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* CRS score — links to full breakdown page */}
      <Link
        href="/dashboard/crs"
        style={{
          display: 'block',
          textDecoration: 'none',
          padding: '16px 16px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <p style={{
          fontFamily: C.fontUi, fontSize: 10, fontWeight: 600,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          color: C.muted, marginBottom: 2,
        }}>
          CRS Score
        </p>
        <p style={{
          fontFamily: C.fontDisplay, fontSize: 40, fontWeight: 400,
          letterSpacing: '-0.02em', lineHeight: 1, color: C.ink,
        }}>
          {Number.isFinite(Number(crsValue)) ? (
            <AnimatedNumber value={Number(crsValue)} durationMs={800} startInView={false} />
          ) : (
            crsValue
          )}
        </p>
        <p style={{ fontFamily: C.fontBody, fontSize: 11, color: C.muted, marginTop: 6 }}>
          View full breakdown →
        </p>
      </Link>

      {/* Profile completeness */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLowCompleteness ? (
          <div style={{
            background: '#FFFBEB',
            border: '1px solid rgba(239, 159, 39, 0.40)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            <p style={{
              fontFamily: C.fontBody, fontSize: 12,
              color: '#78350F', lineHeight: 1.5, marginBottom: 8,
            }}>
              Profile is {clamped}% complete — this estimate may not be accurate yet.
            </p>
            <Link
              href="/dashboard/profile"
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '6px 14px', borderRadius: 9999,
                background: C.ink, color: '#FFFFFF',
                fontFamily: C.fontUi, fontSize: 12, fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Complete your profile →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={{
              fontFamily: C.fontUi, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.10em', textTransform: 'uppercase', color: C.muted,
            }}>
              Profile {clamped}% complete
            </p>
            <Link href="/dashboard/profile" style={{
              fontFamily: C.fontBody, fontSize: 12, color: C.accent, textDecoration: 'none',
            }}>
              View →
            </Link>
          </div>
        )}

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Profile ${clamped}% complete`}
          style={{ height: 3, background: 'rgba(0,0,0,0.10)', borderRadius: 9999 }}
        >
          <div style={{
            height: '100%', width: `${clamped}%`,
            background: barColor, borderRadius: 9999,
            transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Compact tablet widget chips (md only) ────────────────────────────────────

/** Compact CRS + completeness shown beneath the stepper on 768–1279px screens. */
function TabletWidgets({ crsValue, completeness }: { crsValue: string; completeness: number }) {
  const clamped = Math.max(0, Math.min(100, completeness));
  return (
    <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
      <Link href="/dashboard/crs" style={{ textDecoration: 'none', flex: 1 }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 12, padding: '8px 12px',
          boxShadow: 'var(--shadow-card-md)',
        }}>
          <p style={{
            fontFamily: C.fontUi, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: C.muted, marginBottom: 1,
          }}>
            CRS
          </p>
          <p style={{ fontFamily: C.fontDisplay, fontSize: 22, fontWeight: 400, lineHeight: 1, color: C.ink }}>
            {crsValue}
          </p>
        </div>
      </Link>
      <Link href="/dashboard/profile" style={{ textDecoration: 'none', flex: 1 }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 12, padding: '8px 12px',
          boxShadow: 'var(--shadow-card-md)',
        }}>
          <p style={{
            fontFamily: C.fontUi, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: C.muted, marginBottom: 1,
          }}>
            Profile
          </p>
          <p style={{ fontFamily: C.fontDisplay, fontSize: 22, fontWeight: 400, lineHeight: 1, color: C.ink }}>
            {clamped}%
          </p>
        </div>
      </Link>
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
        padding: '20px 24px 16px',
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
      <div
        className="xl:flex-1 xl:min-h-0 xl:overflow-y-auto"
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

/** Stepper-anchored 3-column layout. Fills its parent flex container at xl. */
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

  const crsValue = data.crsScore !== null ? String(data.crsScore) : '—';
  const entryVis = isVisible ? ' is-visible' : '';

  const handleDrawerClose = () => {
    setSelectedStep(null);
    router.refresh();
  };

  return (
    <DashboardDataProvider data={data}>
      {/*
        Flex-fill wrapper: takes all available height from page.tsx's flex column.
        On xl, this makes the greeting + 3-column row share the viewport height.
      */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Greeting — fixed height, never scrolls */}
        <div style={{ marginBottom: 24, flexShrink: 0 }}>
          <GreetingHeader firstName={data.firstName} isVisible={isVisible} />
        </div>

        {/* 3-column content row
            xl: fills remaining height, overflow hidden (each column scrolls internally)
            md: natural height, row direction, page scrolls
            mobile: natural height, stacked, page scrolls
        */}
        <div
          className={`pw-entry flex flex-col md:flex-row items-start xl:flex-1 xl:min-h-0 xl:overflow-hidden xl:items-stretch${entryVis}`}
          style={{ gap: 20, transitionDelay: '120ms' }}
        >
          {/* Left: stepper card + tablet chips */}
          <div
            className="w-full md:w-2/5 xl:w-60 md:flex-shrink-0 flex flex-col xl:overflow-hidden"
            style={{ gap: 20 }}
          >
            {/* Stepper card — flex-fills the column at xl */}
            <div
              className="xl:flex-1 xl:min-h-0 xl:flex xl:flex-col xl:overflow-hidden"
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: '20px',
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

            {/* Tablet compact chips — hidden at xl (xl widget replaces them) */}
            <div className="hidden md:flex xl:hidden" style={{ gap: 10 }}>
              <TabletWidgets crsValue={crsValue} completeness={data.profileCompleteness} />
            </div>
          </div>

          {/* Center: current step inline card */}
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

          {/* Right: combined CRS + profile widget (xl only) */}
          <div
            className="hidden xl:flex xl:flex-col xl:flex-shrink-0"
            style={{ width: 240 }}
          >
            <CrsProfileWidget crsValue={crsValue} completeness={data.profileCompleteness} />
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
