import { Target, ClipboardList, TrendingUp, MapPin, Clock, User } from 'lucide-react';
import type { DashboardData, Recommendation } from '@/modules/dashboard/types';

interface RecommendationsCardProps {
  data: DashboardData;
}

interface BenefitRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
}

function BenefitRow({ icon, label, description }: BenefitRowProps) {
  return (
    <li className="flex gap-3 items-start">
      <span className="text-accent-500 flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-text-primary" style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Urbanist, sans-serif' }}>
          {label}
        </p>
        <p className="text-text-tertiary" style={{ fontSize: '12px' }}>{description}</p>
      </div>
    </li>
  );
}

function OnboardingIncompleteVariant() {
  return (
    <>
      <h2 className="card-title mb-4">Why complete your profile?</h2>
      <ul className="flex flex-col gap-4">
        <BenefitRow
          icon={<Target size={20} />}
          label="Get matched to the right pathway"
          description="We analyse 20+ eligibility factors to find your best route."
        />
        <BenefitRow
          icon={<ClipboardList size={20} />}
          label="Generate your personalised checklist"
          description="Every document and step, tailored to your pathway."
        />
        <BenefitRow
          icon={<TrendingUp size={20} />}
          label="Track your application progress"
          description="From first step to landing — all in one place."
        />
      </ul>
    </>
  );
}

function PathwayNotSelectedVariant({ data }: RecommendationsCardProps) {
  const minTime = data.recommendedPathways[0]
    ? data.recommendedPathways[0].processingTime.split('–')[0] ?? 'a few months'
    : 'a few months';
  const maxTime = data.recommendedPathways[0]
    ? data.recommendedPathways[0].processingTime.split('–')[1] ?? 'over a year'
    : 'over a year';

  return (
    <>
      <h2 className="card-title mb-4">How pathway matching works</h2>
      <ul className="flex flex-col gap-4">
        <BenefitRow
          icon={<MapPin size={20} />}
          label="Pathways differ by requirements"
          description="Salary thresholds, experience, and qualifications vary by route."
        />
        <BenefitRow
          icon={<Clock size={20} />}
          label="Processing times vary"
          description={`From ${minTime} to ${maxTime} depending on pathway.`}
        />
        <BenefitRow
          icon={<User size={20} />}
          label="Your profile determines eligibility"
          description="We match you based on your education, work history, and language scores."
        />
      </ul>
    </>
  );
}

function RecommendationRow({ rec }: { rec: Recommendation }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-text-primary" style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Urbanist, sans-serif' }}>
          {rec.label}
        </p>
        {rec.impactLabel && (
          <span
            className="flex-shrink-0 px-2 py-0.5 rounded-badge text-accent-800"
            style={{ fontSize: '11px', fontWeight: 600, background: 'var(--color-accent-100)', fontFamily: 'Urbanist, sans-serif' }}
          >
            {rec.impactLabel}
          </span>
        )}
      </div>
      <p className="text-text-tertiary" style={{ fontSize: '12px' }}>{rec.description}</p>
      <a href="/pathways" className="text-accent-600 mt-0.5" style={{ fontSize: '13px', fontWeight: 600 }}>
        Learn more →
      </a>
    </li>
  );
}

function ApplicationInProgressVariant({ data }: RecommendationsCardProps) {
  return (
    <>
      <p className="label-eyebrow">IMPROVE YOUR SCORE</p>
      <h2 className="card-title mt-0.5 mb-4">Recommended actions</h2>
      <ul className="flex flex-col gap-4">
        {data.recommendations.map((rec) => (
          <RecommendationRow key={rec.id} rec={rec} />
        ))}
      </ul>
    </>
  );
}

function ApplicationSubmittedVariant() {
  return (
    <>
      <p className="label-eyebrow">NEXT STEPS</p>
      <h2 className="card-title mt-0.5 mb-4">While you wait</h2>
      <ul className="flex flex-col gap-4">
        <li className="flex flex-col gap-0.5">
          <p className="text-text-primary" style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Urbanist, sans-serif' }}>
            Book your medical exam
          </p>
          <p className="text-text-tertiary" style={{ fontSize: '12px' }}>Required before your visa is issued.</p>
          {/* href flagged: IRCC external URLs not confirmed yet */}
          <a href="#" className="text-accent-600 mt-0.5" style={{ fontSize: '13px', fontWeight: 600 }}>Book now →</a>
        </li>
        <li className="flex flex-col gap-0.5">
          <p className="text-text-primary" style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Urbanist, sans-serif' }}>
            Prepare proof of funds
          </p>
          <p className="text-text-tertiary" style={{ fontSize: '12px' }}>Have bank statements ready for the past 6 months.</p>
          <a href="#" className="text-accent-600 mt-0.5" style={{ fontSize: '13px', fontWeight: 600 }}>Learn more →</a>
        </li>
        <li className="flex flex-col gap-0.5">
          <p className="text-text-primary" style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Urbanist, sans-serif' }}>
            Track on IRCC portal
          </p>
          <p className="text-text-tertiary" style={{ fontSize: '12px' }}>Check your application status on the official portal.</p>
          <a href="#" className="text-accent-600 mt-0.5" style={{ fontSize: '13px', fontWeight: 600 }}>Open portal →</a>
        </li>
      </ul>
    </>
  );
}

/** White card showing recommendations or informational content. */
export function RecommendationsCard({ data }: RecommendationsCardProps) {
  return (
    <div className="card h-full">
      {data.state === 'onboarding_incomplete' && <OnboardingIncompleteVariant />}
      {data.state === 'pathway_not_selected' && <PathwayNotSelectedVariant data={data} />}
      {data.state === 'application_in_progress' && <ApplicationInProgressVariant data={data} />}
      {data.state === 'application_submitted' && <ApplicationSubmittedVariant />}
    </div>
  );
}
