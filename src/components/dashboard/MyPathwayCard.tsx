import Link from 'next/link';
import { Check } from 'lucide-react';
import { CrsChip } from './CrsChip';
import type { DashboardData, LatestDraw } from '@/modules/dashboard/types';

interface MyPathwayCardProps {
  data: DashboardData;
  isVisible?: boolean;
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
  const size = { width: 22, height: 22, fontSize: 10 };
  const base: React.CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '1px solid',
  };

  if (status === 'done') {
    return (
      <div
        className="pw-step-num"
        style={{
          ...base,
          ...size,
          background: 'var(--pw-ink)',
          borderColor: 'var(--pw-ink)',
          color: '#fff',
        }}
      >
        <Check size={13} strokeWidth={3} />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className="pw-step-num"
        style={{
          ...base,
          ...size,
          background: 'transparent',
          borderColor: 'var(--pw-ink)',
          color: 'var(--pw-ink)',
          fontWeight: 600,
        }}
      >
        {number}
      </div>
    );
  }
  return (
    <div
      className="pw-step-num"
      style={{
        ...base,
        ...size,
        background: 'transparent',
        borderColor: 'rgba(0,0,0,0.15)',
        color: 'var(--pw-muted)',
      }}
    >
      {number}
    </div>
  );
}

function StepRow({
  step,
  number,
  isLast,
  entryClass,
  entryDelay,
}: {
  step: StepDef;
  number: number;
  isLast: boolean;
  entryClass: string;
  entryDelay: number;
}) {
  const isActive = step.status === 'active';

  return (
    <div
      className={`flex gap-3 ${entryClass}`}
      style={{ flex: isActive ? 2.5 : 1, transitionDelay: `${entryDelay}ms` }}
    >
      {/* Left: node + connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <StepNode status={step.status} number={number} />
        {!isLast && (
          <div
            style={{ width: '1.5px', minHeight: 4, flex: 1, background: 'rgba(0,0,0,0.08)', marginTop: 2 }}
          />
        )}
      </div>

      {/* Right: label + CTA */}
      <div className="flex flex-col justify-center gap-1.5 min-w-0 pb-1">
        <p
          style={{
            fontSize: '12px',
            color:
              step.status === 'done'
                ? 'var(--pw-muted)'
                : step.status === 'active'
                ? 'var(--pw-ink)'
                : 'var(--pw-muted)',
            fontFamily: 'var(--pw-font-body)',
            fontWeight: step.status === 'active' ? 500 : 400,
            lineHeight: 1.2,
          }}
        >
          {step.label}
        </p>
        {step.subtitle && (
          <p style={{ fontSize: '10px', color: 'var(--pw-muted)', fontFamily: 'var(--pw-font-body)' }}>
            {step.subtitle}
          </p>
        )}
        {isActive && step.ctaLabel && step.ctaHref && (
          <Link
            href={step.ctaHref}
            className="mt-1 pw-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 14px',
              fontSize: '11px',
              fontFamily: 'var(--pw-font-body)',
              fontWeight: 500,
              color: '#fff',
              background: 'var(--pw-ink)',
              borderRadius: '9999px',
              textDecoration: 'none',
              flexShrink: 0,
              alignSelf: 'flex-start',
            }}
          >
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
  latestDraw: LatestDraw | null;
}

/** Formats an ISO date string as "D Mon YYYY". */
function formatDrawDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Maps a raw draw_type value to a short human-readable stream label. */
function formatDrawType(drawType: string | null): string {
  if (!drawType) return 'Express Entry';
  const t = drawType.trim();
  if (t === 'No Program Specified') return 'Express Entry';
  return t;
}

function DrawContext({
  crsScore,
  draw,
}: {
  crsScore: number | null;
  draw: LatestDraw;
}) {
  const gap = crsScore !== null ? draw.cutoffScore - crsScore : null;
  const isAbove = gap !== null && gap <= 0;
  const streamLabel = formatDrawType(draw.drawType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 10 }}>
      <p className="pw-eyebrow">Draw cutoff</p>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '18px',
          fontWeight: 500,
          color: 'var(--pw-ink)',
          lineHeight: 1,
        }}
      >
        {draw.cutoffScore}
      </p>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '12px',
          fontWeight: 400,
          color: 'var(--pw-muted)',
          lineHeight: 1.3,
        }}
      >
        Latest {streamLabel} draw · {formatDrawDate(draw.drawDate)}
      </p>
      {gap !== null && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 9999,
            fontSize: '10px',
            fontFamily: 'var(--pw-font-body)',
            fontWeight: 500,
            background: isAbove ? '#DCFCE7' : '#FEF3C7',
            color: isAbove ? '#16A34A' : '#D97706',
            alignSelf: 'flex-start',
          }}
          aria-label={isAbove ? 'Above draw cutoff' : `Below draw cutoff by ${gap} points`}
        >
          {isAbove
            ? 'Above cutoff ✓'
            : `Below cutoff — ${gap} pts to go`}
        </span>
      )}
    </div>
  );
}

function DataPendingDraw() {
  // FLAG: needs express_entry_draws scraper for comprehensive draw history
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 10 }}>
      <p className="pw-eyebrow">Latest draw cutoff</p>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '12px',
          color: 'var(--pw-muted)',
          fontStyle: 'italic',
        }}
      >
        Draw data coming soon
      </p>
    </div>
  );
}

function CardHeader({ pathwayLabel, pathwaySubtitle, crsValue, latestDraw }: HeaderProps) {
  const crsNum = Number.isFinite(Number(crsValue)) ? Number(crsValue) : null;
  return (
    <div className="flex-shrink-0" style={{ padding: '22px 22px 18px' }}>
      <p className="pw-eyebrow">MY PATHWAY</p>
      <p
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: '22px',
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.2,
          marginTop: 6,
        }}
      >
        {pathwayLabel}
      </p>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: '12px',
          fontStyle: 'italic',
          color: 'var(--pw-muted)',
          marginTop: 3,
        }}
      >
        {pathwaySubtitle}
      </p>

      {/* Stats row: CRS chip + draw context (no pool rank — no real source in DB) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 16 }}>
        <CrsChip crsValue={crsValue} />
        {latestDraw ? (
          <DrawContext crsScore={crsNum} draw={latestDraw} />
        ) : (
          <DataPendingDraw />
        )}
      </div>
    </div>
  );
}

/* ── Checklist body ──────────────────────────────────────────────────── */

function ChecklistBody({ steps, isVisible }: { steps: StepDef[]; isVisible: boolean }) {
  const entryClass = `pw-entry${isVisible ? ' is-visible' : ''}`;
  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '12px 22px 10px' }}
    >
      {steps.map((step, i) => (
        <StepRow
          key={step.label}
          step={step}
          number={i + 1}
          isLast={i === steps.length - 1}
          entryClass={entryClass}
          entryDelay={280 + i * 50}
        />
      ))}
    </div>
  );
}

/* ── State variants ─────────────────────────────────────────────────── */

/** Returns "X–Y months" from processing time strings, or a fallback. */
function processingTimeLabel(min: string | null, max: string | null): string {
  if (min && max) return `${min}–${max} months`;
  if (min) return `${min}+ months`;
  return 'Processing time varies';
}

function State1({ data, isVisible }: MyPathwayCardProps & { isVisible: boolean }) {
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
        latestDraw={data.latestDraw}
      />
      <ChecklistBody steps={steps} isVisible={isVisible} />
    </>
  );
}

function State2({ data, isVisible }: MyPathwayCardProps & { isVisible: boolean }) {
  const crs = data.crsScore !== null ? String(data.crsScore) : '—';
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
        latestDraw={data.latestDraw}
      />
      <ChecklistBody steps={steps} isVisible={isVisible} />
    </>
  );
}

function State2b({ data, isVisible }: MyPathwayCardProps & { isVisible: boolean }) {
  const crs = data.crsScore !== null ? String(data.crsScore) : '—';
  const subtitle = processingTimeLabel(
    data.selectedPathwayProcessingTime?.split('–')[0] ?? null,
    data.selectedPathwayProcessingTime?.split('–')[1] ?? null,
  );
  const steps: StepDef[] = [
    { label: 'Profile complete',       status: 'done' },
    { label: 'Pathway selected',       status: 'done' },
    { label: 'Begin your application', status: 'active', ctaLabel: 'Start application →', ctaHref: '/dashboard/application' },
    { label: 'Submit application',     status: 'locked' },
    { label: 'Receive decision',       status: 'locked' },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel={data.selectedPathwayTitle ?? 'Pathway Selected'}
        pathwaySubtitle={subtitle}
        crsValue={crs}
        latestDraw={data.latestDraw}
      />
      <ChecklistBody steps={steps} isVisible={isVisible} />
    </>
  );
}

function State3({ data, isVisible }: MyPathwayCardProps & { isVisible: boolean }) {
  const crs = data.crsScore !== null ? String(data.crsScore) : '—';
  const stream = data.pathwayOfficialName ?? 'Federal Skilled Worker';
  const timeLabel = processingTimeLabel(data.processingTimeMin, data.processingTimeMax);

  const steps: StepDef[] = [
    { label: 'Profile submitted',    status: 'done' },
    {
      label: 'Invitation to apply',
      status: 'active',
      subtitle: `Active · exp ${data.processingTimeMax ? `${data.processingTimeMax} months` : '—'}`,
      ctaLabel: 'Continue application →',
      ctaHref: data.applicationId ? `/applications/${data.applicationId}` : '/dashboard',
    },
    { label: 'Medical exam',          status: 'locked', subtitle: 'Unlocks after submission' },
    { label: 'COPR issued',           status: 'locked', subtitle: 'Confirmation of permanent residence' },
    { label: 'Landing',               status: 'locked', subtitle: `Est. ${timeLabel}` },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel={data.pathwayTitle ?? 'Express Entry'}
        pathwaySubtitle={stream}
        crsValue={crs}
        latestDraw={data.latestDraw}
      />
      <ChecklistBody steps={steps} isVisible={isVisible} />
    </>
  );
}

function State4({ data, isVisible }: MyPathwayCardProps & { isVisible: boolean }) {
  const crs = data.crsScore !== null ? String(data.crsScore) : '—';
  const stream = data.pathwayOfficialName ?? 'Federal Skilled Worker';
  const timeLabel = processingTimeLabel(data.processingTimeMin, data.processingTimeMax);

  const steps: StepDef[] = [
    { label: 'Profile submitted',    status: 'done' },
    { label: 'Application submitted', status: 'done' },
    { label: 'Biometrics',           status: 'active', ctaLabel: 'Complete biometrics →', ctaHref: data.applicationId ? `/applications/${data.applicationId}` : '/dashboard' },
    { label: 'Medical exam',         status: 'locked' },
    { label: 'Decision / Landing',   status: 'locked', subtitle: `Est. ${timeLabel}` },
  ];
  return (
    <>
      <CardHeader
        pathwayLabel={data.pathwayTitle ?? 'Express Entry'}
        pathwaySubtitle={stream}
        crsValue={crs}
        latestDraw={data.latestDraw}
      />
      <ChecklistBody steps={steps} isVisible={isVisible} />
    </>
  );
}

/** Right-column card: pathway header + step checklist. Always present. */
export function MyPathwayCard({ data, isVisible = false }: MyPathwayCardProps) {
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden rounded-card min-h-0"
      style={{ background: '#FFFFFF', borderLeft: '1px solid rgba(0,0,0,0.08)' }}
    >
      {data.state === 'onboarding_incomplete'   && <State1 data={data} isVisible={isVisible} />}
      {data.state === 'pathway_not_selected'    && <State2 data={data} isVisible={isVisible} />}
      {data.state === 'pathway_selected'        && <State2b data={data} isVisible={isVisible} />}
      {data.state === 'application_in_progress' && <State3 data={data} isVisible={isVisible} />}
      {data.state === 'application_submitted'   && <State4 data={data} isVisible={isVisible} />}
    </div>
  );
}
