import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import type { DashboardData, ApplicationStep } from '@/modules/dashboard/types';

interface StepTrackerCardProps {
  data: DashboardData;
}

// ─── Shared step node styles ──────────────────────────────────────────────────

interface StepNodeProps {
  label: string | number;
  status: 'complete' | 'current' | 'upcoming';
  title: string;
  description: string;
  duration?: string;
  ctaHref?: string;
  ctaLabel?: string;
  isLast?: boolean;
}

function StepNode({ label, status, title, description, duration, ctaHref, ctaLabel, isLast }: StepNodeProps) {
  const circleClass =
    status === 'complete'
      ? 'bg-accent-500 text-white'
      : status === 'current'
        ? 'bg-bg-surface border-2 border-accent-500 text-accent-600'
        : 'bg-bg-muted text-text-disabled';

  const titleClass = status === 'upcoming' ? 'text-text-disabled' : 'text-text-primary';

  return (
    <li className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div
          className={`flex items-center justify-center rounded-full flex-shrink-0 ${circleClass}`}
          style={{ width: 20, height: 20, fontSize: '11px', fontWeight: 600, fontFamily: 'Urbanist, sans-serif' }}
        >
          {status === 'complete' ? (
            <CheckCircle2 size={12} className="text-white" />
          ) : (
            <span>{label}</span>
          )}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border-light mt-1" style={{ minHeight: 16 }} />
        )}
      </div>

      {/* Content */}
      <div className="pb-4 flex-1">
        <p className={`${titleClass}`} style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Urbanist, sans-serif' }}>
          {title}
        </p>
        <p className="text-text-tertiary truncate" style={{ fontSize: '12px' }}>
          {description}
        </p>
        {duration && (
          <p className="text-text-tertiary" style={{ fontSize: '12px' }}>{duration}</p>
        )}
        {ctaHref && ctaLabel && status === 'current' && (
          <Link
            href={ctaHref}
            className="btn-primary mt-2"
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </li>
  );
}

// ─── State variants ───────────────────────────────────────────────────────────

function OnboardingIncompleteVariant({ data }: StepTrackerCardProps) {
  const completedCount = data.onboardingSteps.filter((s) => s.completed).length;
  const badgeClass = completedCount > 0 ? 'badge badge-progress' : 'badge badge-warning';

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="label-eyebrow">ONBOARDING CHECKLIST</p>
          <h2 className="card-title mt-0.5">Getting started</h2>
        </div>
        <span className={badgeClass}>{completedCount} of {data.onboardingSteps.length} complete</span>
      </div>

      <ul className="flex flex-col">
        {data.onboardingSteps.map((step, i) => {
          const status: 'complete' | 'current' | 'upcoming' = step.completed
            ? 'complete'
            : data.onboardingSteps.slice(0, i).every((s) => s.completed)
              ? 'current'
              : 'upcoming';

          return (
            <StepNode
              key={step.id}
              label={i + 1}
              status={status}
              title={step.label}
              description={step.description}
              ctaHref="/onboarding"
              ctaLabel="Complete →"
              isLast={i === data.onboardingSteps.length - 1}
            />
          );
        })}
      </ul>
    </>
  );
}

const PATHWAY_NOT_SELECTED_STEPS = [
  { label: 'Profile complete', status: 'complete' as const, description: 'Your profile is ready.' },
  { label: 'Choose a pathway', status: 'current' as const, description: 'Browse options and select the right route.' },
  { label: 'Build your checklist', status: 'upcoming' as const, description: 'Your document list will be generated.' },
  { label: 'Submit application', status: 'upcoming' as const, description: 'Send your completed application.' },
];

function PathwayNotSelectedVariant() {
  return (
    <>
      <div className="mb-4">
        <p className="label-eyebrow">NEXT STEPS</p>
        <h2 className="card-title mt-0.5">Choose your pathway</h2>
      </div>

      <ul className="flex flex-col">
        {PATHWAY_NOT_SELECTED_STEPS.map((step, i) => (
          <StepNode
            key={step.label}
            label={i + 1}
            status={step.status}
            title={step.label}
            description={step.description}
            ctaHref="/pathways"
            ctaLabel="Browse pathways →"
            isLast={i === PATHWAY_NOT_SELECTED_STEPS.length - 1}
          />
        ))}
      </ul>

      <div className="border-t border-border-light pt-3 mt-2">
        <p className="text-text-tertiary" style={{ fontSize: '12px' }}>
          Your checklist will be generated automatically once you select a pathway.
        </p>
      </div>
    </>
  );
}

function ApplicationInProgressVariant({ data }: StepTrackerCardProps) {
  const pendingBadgeLabel =
    data.pendingDocumentsCount === 1
      ? '1 doc pending'
      : `${data.pendingDocumentsCount} docs pending`;

  return (
    <>
      <div className="mb-4">
        <p className="label-eyebrow">APPLICATION STEPS</p>
        <h2 className="card-title mt-0.5">{data.pathwayTitle ?? 'Your pathway'}</h2>
      </div>

      <ul className="flex flex-col overflow-y-auto flex-1">
        {data.applicationSteps.map((step: ApplicationStep, i) => (
          <StepNode
            key={step.id}
            label={step.stepNumber}
            status={step.status}
            title={step.label}
            description={step.description}
            duration={step.estimatedDuration}
            ctaHref={data.applicationId ? `/applications/${data.applicationId}` : '#'}
            ctaLabel="Complete →"
            isLast={i === data.applicationSteps.length - 1}
          />
        ))}
      </ul>

      {data.pendingDocumentsCount > 0 && data.applicationId && (
        <Link
          href={`/applications/${data.applicationId}/documents`}
          className="mt-3 inline-flex"
        >
          <span
            className="badge"
            style={{
              background: 'var(--color-accent-50)',
              color: 'var(--color-accent-700)',
              border: '1px solid var(--color-accent-200)',
            }}
          >
            {pendingBadgeLabel}
          </span>
        </Link>
      )}
    </>
  );
}

function ApplicationSubmittedVariant({ data }: StepTrackerCardProps) {
  const submittedDate = data.applicationSubmittedAt
    ? new Date(data.applicationSubmittedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <>
      <div className="mb-4">
        <p className="label-eyebrow">APPLICATION STEPS</p>
        <h2 className="card-title mt-0.5">Application complete</h2>
      </div>

      <ul className="flex flex-col overflow-y-auto flex-1">
        {data.applicationSteps.map((step: ApplicationStep, i) => (
          <StepNode
            key={step.id}
            label={step.stepNumber}
            status="complete"
            title={step.label}
            description={step.description}
            isLast={i === data.applicationSteps.length - 1}
          />
        ))}

        {/* Final node */}
        <li className="flex gap-3">
          <div className="flex flex-col items-center">
            <CheckCircle2 size={20} className="text-accent-500" />
          </div>
          <div className="pb-4">
            <p className="text-text-primary" style={{ fontWeight: 600, fontSize: '14px' }}>
              Submitted to IRCC
            </p>
          </div>
        </li>
      </ul>

      {submittedDate && (
        <p className="text-text-tertiary mt-2" style={{ fontSize: '12px' }}>
          {submittedDate}
        </p>
      )}
    </>
  );
}

/** Full-height centre card showing the step-by-step progress tracker. */
export function StepTrackerCard({ data }: StepTrackerCardProps) {
  return (
    <div className="card h-full flex flex-col">
      {data.state === 'onboarding_incomplete' && <OnboardingIncompleteVariant data={data} />}
      {data.state === 'pathway_not_selected' && <PathwayNotSelectedVariant />}
      {data.state === 'application_in_progress' && <ApplicationInProgressVariant data={data} />}
      {data.state === 'application_submitted' && <ApplicationSubmittedVariant data={data} />}
    </div>
  );
}
