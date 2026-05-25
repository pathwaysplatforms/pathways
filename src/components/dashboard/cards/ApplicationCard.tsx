import Link from 'next/link';
import { Lock, CheckCircle2 } from 'lucide-react';
import type { DashboardData } from '@/modules/dashboard/types';

interface ApplicationCardProps {
  data: DashboardData;
}

function OnboardingIncompleteVariant() {
  return (
    <>
      <h2 className="card-title">Your Application</h2>
      <div className="flex flex-col items-center justify-center flex-1 py-6 gap-3">
        <Lock size={32} className="text-text-disabled" />
        <p className="text-text-secondary text-center" style={{ fontSize: '14px' }}>
          Complete your profile to unlock your application.
        </p>
      </div>
      <Link href="/onboarding" className="btn-primary w-full justify-center">
        Start onboarding
      </Link>
    </>
  );
}

function PathwayNotSelectedVariant({ data }: ApplicationCardProps) {
  const topPathway = data.recommendedPathways[0];
  return (
    <>
      <h2 className="card-title">Start Your Application</h2>
      <p className="text-text-secondary mt-2" style={{ fontSize: '14px' }}>
        Choose a pathway to generate your personalised checklist.
      </p>
      {topPathway && (
        <p className="mt-2 text-accent-600" style={{ fontSize: '13px', fontWeight: 600 }}>
          Recommended: {topPathway.name}
        </p>
      )}
      <div className="mt-4">
        <Link href="/pathways" className="btn-primary w-full justify-center">
          Browse pathways
        </Link>
      </div>
    </>
  );
}

function ApplicationInProgressVariant({ data }: ApplicationCardProps) {
  const currentStep = data.applicationSteps.find((s) => s.status === 'current');
  const ratio =
    data.totalStepsCount > 0
      ? (data.completedStepsCount / data.totalStepsCount) * 100
      : 0;

  return (
    <>
      <h2 className="card-title">Application Progress</h2>

      {/* Fraction */}
      <div className="flex items-baseline gap-1 mt-3">
        <span
          className="text-accent-600"
          style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 800, fontSize: '28px', lineHeight: 1 }}
        >
          {data.completedStepsCount}
        </span>
        <span className="text-text-tertiary" style={{ fontSize: '16px' }}>
          / {data.totalStepsCount}
        </span>
      </div>
      <p className="label-eyebrow mt-0.5">steps complete</p>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-500"
          style={{ width: `${ratio}%` }}
        />
      </div>

      {/* Next step */}
      {currentStep && (
        <p className="mt-2 text-text-secondary truncate" style={{ fontSize: '13px', fontWeight: 500 }}>
          Next: {currentStep.label}
        </p>
      )}

      {data.applicationId && (
        <div className="mt-4">
          <Link
            href={`/applications/${data.applicationId}`}
            className="btn-primary w-full justify-center"
          >
            Continue
          </Link>
        </div>
      )}
    </>
  );
}

function ApplicationSubmittedVariant({ data }: ApplicationCardProps) {
  const submittedDate = data.applicationSubmittedAt
    ? `Submitted ${new Date(data.applicationSubmittedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`
    : null;

  return (
    <>
      <h2 className="card-title">Application Submitted</h2>
      <div className="flex flex-col items-center justify-center flex-1 py-6 gap-3">
        <CheckCircle2 size={36} className="text-status-success-dot" style={{ color: '#22C55E' }} />
        <p className="text-text-secondary text-center" style={{ fontSize: '14px' }}>
          Your application has been submitted.
        </p>
        {submittedDate && (
          <p className="text-text-tertiary text-center" style={{ fontSize: '12px' }}>
            {submittedDate}
          </p>
        )}
      </div>
      {data.applicationId && (
        <Link
          href={`/applications/${data.applicationId}`}
          className="btn-secondary w-full justify-center"
        >
          View application
        </Link>
      )}
    </>
  );
}

/** White card showing application status or onboarding CTA. */
export function ApplicationCard({ data }: ApplicationCardProps) {
  return (
    <div className="card flex flex-col">
      {data.state === 'onboarding_incomplete' && <OnboardingIncompleteVariant />}
      {data.state === 'pathway_not_selected' && <PathwayNotSelectedVariant data={data} />}
      {data.state === 'application_in_progress' && <ApplicationInProgressVariant data={data} />}
      {data.state === 'application_submitted' && <ApplicationSubmittedVariant data={data} />}
    </div>
  );
}
