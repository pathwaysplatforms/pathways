import Link from 'next/link';
import { Check } from 'lucide-react';
import type { DashboardData } from '@/modules/dashboard/types';

interface MyPathwayCardProps {
  data: DashboardData;
}

/* ── Step node ────────────────────────────────────────────────────── */

type StepStatus = 'done' | 'active' | 'locked';

interface StepDef {
  label: string;
  subtitle?: string;
  status: StepStatus;
  ctaLabel?: string;
  ctaHref?: string;
}

function StepNode({ status, number }: { status: StepStatus; number: number }) {
  const base = 'flex-shrink-0 flex items-center justify-center rounded-full border';
  const size = { width: 22, height: 22, fontSize: 10 };

  if (status === 'done') {
    return (
      <div
        className={`${base} bg-accent-600 border-accent-600 text-white`}
        style={size}
      >
        <Check size={13} strokeWidth={3} />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className={`${base} bg-accent-50 border-accent-500 text-accent-600 font-semibold`}
        style={size}
      >
        {number}
      </div>
    );
  }
  return (
    <div
      className={`${base} border-border-light text-text-tertiary`}
      style={size}
    >
      {number}
    </div>
  );
}

function StepRow({
  step,
  number,
  isLast,
}: {
  step: StepDef;
  number: number;
  isLast: boolean;
}) {
  const isActive = step.status === 'active';

  return (
    <div className="flex gap-3" style={{ flex: isActive ? 2.5 : 1 }}>
      {/* Left: node + connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <StepNode status={step.status} number={number} />
        {!isLast && (
          <div
            className="flex-1 bg-border-light mt-0.5"
            style={{ width: '1.5px', minHeight: 4 }}
          />
        )}
      </div>

      {/* Right: label + CTA */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0 pb-1">
        <p
          className={
            step.status === 'done'
              ? 'text-text-tertiary'
              : step.status === 'active'
              ? 'text-text-primary font-extrabold leading-none'
              : 'text-text-secondary leading-none'
          }
          style={{ fontSize: '12px' }}
        >
          {step.label}
        </p>
        {step.subtitle && (
          <p className="text-text-tertiary" style={{ fontSize: '10px' }}>
            {step.subtitle}
          </p>
        )}
        {isActive && step.ctaLabel && step.ctaHref && (
          <Link href={step.ctaHref} className="btn-primary mt-1" style={{ fontSize: '11px', padding: '6px 12px' }}>
            {step.ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Card header ─────────────────────────────────────────────────────── */

interface HeaderProps {
  pathwayLabel: string;
  pathwaySubtitle: string;
  crsValue: string;
  poolRank: string;
  poolRankColor: string;
  poolDotColor: string;
}

function CardHeader({
  pathwayLabel,
  pathwaySubtitle,
  crsValue,
  poolRank,
  poolRankColor,
  poolDotColor,
}: HeaderProps) {
  return (
    <div className="flex-shrink-0" style={{ padding: '22px 22px 18px' }}>
      <p
        className="text-text-tertiary uppercase"
        style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em' }}
      >
        MY PATHWAY
      </p>
      <p
        className="text-text-primary font-extrabold leading-tight"
        style={{ fontSize: '21px', letterSpacing: '-0.02em', marginTop: 7 }}
      >
        {pathwayLabel}
      </p>
      <p
        className="text-accent-600 font-medium italic"
        style={{ fontSize: '12px', marginTop: 4 }}
      >
        {pathwaySubtitle}
      </p>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 16 }}>
        {/* CRS chip */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-subtle)',
            borderRadius: 10,
            padding: '10px 16px',
          }}
        >
          <p
            className="text-text-tertiary uppercase"
            style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em' }}
          >
            CRS Score
          </p>
          <p
            className="font-extrabold"
            style={{ fontSize: '36px', letterSpacing: '-0.04em', lineHeight: 1, marginTop: 3, color: 'var(--color-accent-500)' }}
          >
            {crsValue}
          </p>
        </div>

        {/* Pool rank — bare, no box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 10 }}>
          <p
            className="text-text-tertiary uppercase"
            style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em' }}
          >
            Pool Rank
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className="rounded-full flex-shrink-0"
              style={{ width: 7, height: 7, background: poolDotColor }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: poolRankColor }}>
              {poolRank}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── State variants ─────────────────────────────────────────────────── */

function State1({ data }: MyPathwayCardProps) {
  const steps: StepDef[] = [
    { label: 'Complete profile',    status: 'active', ctaLabel: 'Finish profile →', ctaHref: '/onboarding/review' },
    { label: 'Receive pathway match', status: 'locked' },
    { label: 'Select your pathway',   status: 'locked' },
    { label: 'Begin application',     status: 'locked' },
    { label: 'Submit application',    status: 'locked' },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel="Pathway Pending"
        pathwaySubtitle="Complete your profile to unlock"
        crsValue="—"
        poolRank="Not yet calculated"
        poolRankColor="var(--color-text-tertiary)"
        poolDotColor="var(--color-text-disabled)"
      />
      <ChecklistBody steps={steps} />
    </>
  );
}

function State2({ data }: MyPathwayCardProps) {
  const crs = data.profileCompleteness > 0 ? String(data.profileCompleteness) : '—';
  const steps: StepDef[] = [
    { label: 'Profile complete',    status: 'done' },
    { label: 'Select a pathway',    status: 'active', ctaLabel: 'Browse pathways →', ctaHref: '/pathways' },
    { label: 'Build your checklist', status: 'locked' },
    { label: 'Submit application',   status: 'locked' },
    { label: 'Receive decision',     status: 'locked' },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel="Not Selected Yet"
        pathwaySubtitle="Choose a pathway to begin"
        crsValue={crs}
        poolRank={`Top ${100 - data.profileCompleteness}% of pool`}
        poolRankColor="#0B7269"
        poolDotColor="#0FA896"
      />
      <ChecklistBody steps={steps} />
    </>
  );
}

function State3({ data }: MyPathwayCardProps) {
  const crs = data.profileCompleteness > 0 ? String(data.profileCompleteness) : '—';
  const stream = data.pathwayOfficialName ?? 'Federal Skilled Worker';

  const steps: StepDef[] = [
    { label: 'Profile submitted',    status: 'done' },
    {
      label: 'Invitation to apply',
      status: 'active',
      subtitle: `Active · exp ${data.processingTimeMax ?? '—'}`,
      ctaLabel: 'Continue application →',
      ctaHref: data.applicationId ? `/applications/${data.applicationId}` : '/dashboard',
    },
    { label: 'Medical exam',          status: 'locked', subtitle: 'Unlocks after submission' },
    { label: 'COPR issued',           status: 'locked', subtitle: 'Confirmation of permanent residence' },
    { label: 'Landing',               status: 'locked', subtitle: `Est. ${data.processingTimeMax ?? '—'}` },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel={data.pathwayTitle ?? 'Express Entry'}
        pathwaySubtitle={stream}
        crsValue={crs}
        poolRank="Top 15% of pool"
        poolRankColor="#0B7269"
        poolDotColor="#0FA896"
      />
      <ChecklistBody steps={steps} />
    </>
  );
}

function State4({ data }: MyPathwayCardProps) {
  const crs = data.profileCompleteness > 0 ? String(data.profileCompleteness) : '—';
  const stream = data.pathwayOfficialName ?? 'Federal Skilled Worker';

  const steps: StepDef[] = [
    { label: 'Profile submitted',    status: 'done' },
    { label: 'Application submitted', status: 'done' },
    { label: 'Biometrics',           status: 'active', ctaLabel: 'Complete biometrics →', ctaHref: data.applicationId ? `/applications/${data.applicationId}` : '/dashboard' },
    { label: 'Medical exam',         status: 'locked' },
    { label: 'Decision / Landing',   status: 'locked', subtitle: `Est. ${data.processingTimeMax ?? '—'}` },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel={data.pathwayTitle ?? 'Express Entry'}
        pathwaySubtitle={stream}
        crsValue={crs}
        poolRank="Submitted ✓"
        poolRankColor="#14532D"
        poolDotColor="#22C55E"
      />
      <ChecklistBody steps={steps} />
    </>
  );
}

function ChecklistBody({ steps }: { steps: StepDef[] }) {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden border-t border-border-light"
      style={{ padding: '12px 22px 10px' }}
    >
      {steps.map((step, i) => (
        <StepRow
          key={step.label}
          step={step}
          number={i + 1}
          isLast={i === steps.length - 1}
        />
      ))}
    </div>
  );
}

/** Right-column card: accent-tinted header + step checklist. Always present. */
export function MyPathwayCard({ data }: MyPathwayCardProps) {
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden rounded-card min-h-0"
      style={{ boxShadow: 'var(--shadow-card-md)' }}
    >
      {data.state === 'onboarding_incomplete'   && <State1 data={data} />}
      {data.state === 'pathway_not_selected'    && <State2 data={data} />}
      {data.state === 'application_in_progress' && <State3 data={data} />}
      {data.state === 'application_submitted'   && <State4 data={data} />}
    </div>
  );
}
