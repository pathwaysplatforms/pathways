'use client';

import type { DashboardData } from '@/modules/dashboard/types';
import { useDashboardData } from '@/contexts/DashboardDataContext';

interface GreetingHeaderProps {
  firstName: string;
  isVisible?: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Derives the dynamic status sub-headline from dashboard state data. */
function deriveSubtitle(data: DashboardData | null): string {
  if (!data) return '';
  const { state, selectedPathwaySteps, applicationSteps } = data;

  if (state === 'onboarding_incomplete' || state === 'pathway_not_selected') {
    return 'Complete your profile to unlock your pathway.';
  }
  if (state === 'application_submitted') {
    return 'Application submitted — awaiting decision.';
  }

  const currentStep =
    selectedPathwaySteps.find((s) => s.status === 'current') ??
    applicationSteps.find((s) => s.status === 'current');

  if (currentStep) {
    const dur = currentStep.estimatedDuration ?? null;
    return `Your next step: ${currentStep.label}${dur ? ` — estimated ${dur}` : ''}.`;
  }

  if (data.totalStepsCount > 0 && data.completedStepsCount >= data.totalStepsCount) {
    return 'Application submitted — awaiting decision.';
  }

  return 'Select a pathway to begin your immigration journey.';
}

/** Date line + personalised greeting + dynamic status sub-headline. */
export function GreetingHeader({ firstName, isVisible = false }: GreetingHeaderProps) {
  const data = useDashboardData();
  const vis = isVisible ? ' is-visible' : '';
  const subtitle = deriveSubtitle(data);

  return (
    <div className="flex-shrink-0">
      <p
        className={`pw-eyebrow pw-entry${vis}`}
        style={{ transitionDelay: '0ms' }}
      >
        {getFormattedDate()}
      </p>
      <h1
        className={`pw-entry${vis}`}
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: '40px',
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.1,
          marginTop: 4,
          transitionDelay: '60ms',
        }}
      >
        {getGreeting()},{' '}
        {firstName}.
      </h1>
      {subtitle && (
        <p
          className={`pw-entry${vis}`}
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: '15px',
            color: 'var(--pw-muted)',
            marginTop: 6,
            transitionDelay: '90ms',
          }}
        >
          {subtitle}
        </p>
      )}
      <hr
        className={`pw-rule-reveal${vis}`}
        style={{ marginTop: 10, transitionDelay: '120ms' }}
      />
    </div>
  );
}
