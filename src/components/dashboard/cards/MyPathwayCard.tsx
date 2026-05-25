import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import type { DashboardData } from '@/modules/dashboard/types';

interface MyPathwayCardProps {
  data: DashboardData;
}

function OnboardingVariant({ data }: MyPathwayCardProps) {
  const completedCount = data.onboardingSteps.filter((s) => s.completed).length;
  const incompleteSteps = data.onboardingSteps.filter((s) => !s.completed).slice(0, 3);
  const allSteps = data.onboardingSteps.slice(0, 3);
  const visibleSteps = incompleteSteps.length > 0 ? incompleteSteps : allSteps;

  return (
    <>
      <p className="label-eyebrow" style={{ opacity: 0.6 }}>MY PATHWAY</p>
      <h2 className="card-title text-white mt-1">Complete your profile</h2>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${data.profileCompleteness}%` }}
          />
        </div>
        <p className="text-white/70 mt-1.5" style={{ fontSize: '12px' }}>
          {completedCount} of {data.onboardingSteps.length} sections complete
        </p>
      </div>

      {/* Step list */}
      <ul className="mt-3 flex flex-col gap-1.5">
        {visibleSteps.map((step) => (
          <li key={step.id} className="flex items-center gap-2">
            {step.completed ? (
              <CheckCircle2 size={14} className="text-white/80 flex-shrink-0" />
            ) : (
              <Circle size={14} className="text-white/50 flex-shrink-0" />
            )}
            <span
              className={step.completed ? 'text-white/80' : 'text-white/60'}
              style={{ fontSize: '13px' }}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-4">
        <Link
          href="/onboarding"
          className="inline-flex items-center justify-center px-4 py-2 text-accent-600 bg-white rounded-btn font-medium text-sm"
          style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 600, fontSize: '14px' }}
        >
          Continue onboarding
        </Link>
      </div>
    </>
  );
}

function PathwayNotSelectedVariant({ data }: MyPathwayCardProps) {
  return (
    <>
      <p className="label-eyebrow" style={{ opacity: 0.6 }}>MY PATHWAY</p>
      <h2 className="card-title text-white mt-1">Your top matches</h2>

      {data.recommendedPathways.length === 0 ? (
        <p className="text-white/70 mt-3" style={{ fontSize: '13px' }}>
          Complete your profile to see matches.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {data.recommendedPathways.map((pathway) => (
            <li key={pathway.id} className="flex items-center justify-between">
              <div>
                <p className="text-white" style={{ fontWeight: 600, fontSize: '13px' }}>
                  {pathway.name}
                </p>
                <p className="text-white/70" style={{ fontSize: '12px' }}>
                  {pathway.processingTime}
                </p>
              </div>
              <span
                className="px-2 py-0.5 text-white rounded-badge"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.2)',
                  fontFamily: 'Urbanist, sans-serif',
                }}
              >
                Eligible
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ApplicationInProgressVariant({ data }: MyPathwayCardProps) {
  const stat =
    data.profileCompleteness > 0 ? `${data.profileCompleteness}%` : '—';

  return (
    <>
      <p className="label-eyebrow" style={{ opacity: 0.6 }}>MY PATHWAY</p>
      <h2 className="card-title text-white mt-1">{data.pathwayTitle ?? '—'}</h2>
      {data.pathwayOfficialName && (
        <p className="text-white/70 mt-0.5" style={{ fontSize: '12px' }}>
          {data.pathwayOfficialName}
        </p>
      )}

      {/* Hero stat — profile_completeness_pct used as MVP proxy for crs_score */}
      <div className="mt-4">
        <p
          className="text-white leading-none"
          style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 800, fontSize: '30px' }}
        >
          {stat}
        </p>
        <p className="text-white/60 mt-1" style={{ fontSize: '11px' }}>Profile complete</p>
      </div>

      {/* Status badge */}
      {data.applicationStatus && (
        <span
          className="mt-3 inline-block px-3 py-1 text-white rounded-pill"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.2)',
            fontFamily: 'Urbanist, sans-serif',
          }}
        >
          {data.applicationStatus}
        </span>
      )}

      {/* Processing time */}
      {data.processingTimeMin && data.processingTimeMax && (
        <p className="text-white/60 mt-3" style={{ fontSize: '12px' }}>
          Processing: {data.processingTimeMin}–{data.processingTimeMax}
        </p>
      )}
    </>
  );
}

function ApplicationSubmittedVariant({ data }: MyPathwayCardProps) {
  const submittedDate = data.applicationSubmittedAt
    ? new Date(data.applicationSubmittedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const refId = data.applicationId ? data.applicationId.slice(0, 8) : '—';

  return (
    <>
      <p className="label-eyebrow" style={{ opacity: 0.6 }}>MY PATHWAY</p>
      <h2 className="card-title text-white mt-1">{data.pathwayTitle ?? '—'}</h2>
      {data.pathwayOfficialName && (
        <p className="text-white/70 mt-0.5" style={{ fontSize: '12px' }}>
          {data.pathwayOfficialName}
        </p>
      )}

      {/* Status */}
      <p className="text-white/50 mt-4" style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Application Status
      </p>
      {data.applicationStatus && (
        <span
          className="mt-1 inline-block px-3 py-1 text-white rounded-pill"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.2)',
            fontFamily: 'Urbanist, sans-serif',
          }}
        >
          {data.applicationStatus}
        </span>
      )}

      {/* Key dates */}
      <ul className="mt-3 flex flex-col gap-1.5">
        {[
          ['Submitted', submittedDate],
          ['Medical exam', 'Pending'],
          ['Decision', 'Pending'],
          ['COPR', '—'],
        ].map(([label, value]) => (
          <li key={label} className="flex justify-between items-center">
            <span className="text-white/60" style={{ fontSize: '12px' }}>{label}</span>
            <span className="text-white" style={{ fontSize: '12px', fontWeight: 500 }}>{value}</span>
          </li>
        ))}
      </ul>

      <p className="text-white/40 mt-4" style={{ fontSize: '11px' }}>
        Ref: {refId}
      </p>
    </>
  );
}

/** Accent card showing pathway status. Always uses card-accent with sheen. */
export function MyPathwayCard({ data }: MyPathwayCardProps) {
  return (
    <div className="card-accent flex flex-col">
      {data.state === 'onboarding_incomplete' && <OnboardingVariant data={data} />}
      {data.state === 'pathway_not_selected' && <PathwayNotSelectedVariant data={data} />}
      {data.state === 'application_in_progress' && <ApplicationInProgressVariant data={data} />}
      {data.state === 'application_submitted' && <ApplicationSubmittedVariant data={data} />}
    </div>
  );
}
