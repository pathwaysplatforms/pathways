'use client';

import Link from 'next/link';
import { deriveMissionControl } from '@/modules/dashboard/mission-control';
import type { MissionControlModel } from '@/modules/dashboard/mission-control';
import type { DashboardData, LatestDraw } from '@/modules/dashboard/types';
import { NextBestActionCard } from './NextBestActionCard';
import { CrsGaugeCard, CrsNumberCard } from './CrsGaugeCard';
import { FswEligibilityCard } from './FswEligibilityCard';
import { JourneyPhaseStrip } from './JourneyPhaseStrip';

/** Formats an ISO date string as "D Mon YYYY". */
function formatDrawDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Onboarding state ─────────────────────────────────────────────────────────

function FinishProfileCta({ firstName }: { firstName: string }) {
  return (
    <div
      className="pw-entry"
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        padding: '32px 28px',
        maxWidth: 560,
      }}
    >
      <p className="pw-eyebrow" style={{ marginBottom: 10 }}>Welcome, {firstName}</p>
      <h1
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: 26,
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.2,
          margin: '0 0 10px',
        }}
      >
        Finish your profile
      </h1>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 14,
          color: 'var(--pw-muted)',
          lineHeight: 1.65,
          margin: '0 0 20px',
        }}
      >
        Complete your immigration profile to unlock pathway matches, your CRS estimate,
        and a step-by-step roadmap.
      </p>
      <Link
        href="/onboarding/review"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '8px 18px',
          borderRadius: 9999,
          background: 'var(--pw-ink)',
          color: '#FFFFFF',
          fontFamily: 'var(--pw-font-ui)',
          fontSize: 13,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Continue profile →
      </Link>
    </div>
  );
}

// ── Heroes ───────────────────────────────────────────────────────────────────

function OrientationHero({ firstName }: { firstName: string }) {
  return (
    <header>
      <p className="pw-eyebrow" style={{ marginBottom: 8 }}>Welcome back, {firstName}</p>
      <h1
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.2,
          margin: '0 0 6px',
        }}
      >
        Find the pathway that fits
      </h1>
      <p
        style={{
          fontFamily: 'var(--pw-font-body)',
          fontSize: 14,
          color: 'var(--pw-muted)',
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Your profile is complete. Run the matcher to turn it into a shortlist of pathways
        you can commit to.
      </p>
    </header>
  );
}

function HeroSeparator() {
  return <span aria-hidden="true" style={{ color: '#D1D5DB' }}>·</span>;
}

function StatusHero({
  firstName,
  pathwayTitle,
  crsScore,
  latestDraw,
  crsGap,
}: {
  firstName: string;
  pathwayTitle: string | null;
  crsScore: number | null;
  latestDraw: LatestDraw | null;
  crsGap: number | null;
}) {
  const segment: React.CSSProperties = {
    fontFamily: 'var(--pw-font-body)',
    fontSize: 14,
    color: 'var(--pw-muted)',
  };
  const value: React.CSSProperties = { color: 'var(--pw-ink)', fontWeight: 500 };

  return (
    <header>
      <p className="pw-eyebrow" style={{ marginBottom: 8 }}>Welcome back, {firstName}</p>
      <h1
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: 28,
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.2,
          margin: '0 0 8px',
        }}
      >
        {pathwayTitle ?? 'Your pathway'}
      </h1>
      {latestDraw !== null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {crsScore !== null && (
            <>
              <span style={segment}>CRS <span style={value}>{crsScore}</span></span>
              <HeroSeparator />
            </>
          )}
          <span style={segment}>
            {latestDraw.isFallback ? 'Nearest comparable cutoff' : 'Last cutoff'} <span style={value}>{latestDraw.cutoffScore}</span>
            {' '}({latestDraw.drawType ?? 'Express Entry'}, {formatDrawDate(latestDraw.drawDate)})
          </span>
          {crsGap !== null && (
            <>
              <HeroSeparator />
              <span className={`badge ${crsGap >= 0 ? 'badge-success' : 'badge-warning'}`}>
                Gap {crsGap >= 0 ? `+${crsGap}` : `${crsGap}`}
              </span>
            </>
          )}
        </div>
      ) : (
        // No live cutoff to compare against: state that plainly instead of
        // asserting a comparison result the code never actually computed.
        crsScore !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={segment}>CRS <span style={value}>{crsScore}</span></span>
            <HeroSeparator />
            <span style={segment}>No live cutoff for this stream right now</span>
          </div>
        )
      )}
    </header>
  );
}

// ── State layouts ────────────────────────────────────────────────────────────

function DiscoveringLayout({ model }: { model: MissionControlModel }) {
  return (
    <>
      <div className="pw-entry"><OrientationHero firstName={model.firstName} /></div>
      <div
        className="pw-entry pw-entry-delay-1"
        style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}
      >
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <NextBestActionCard actions={model.actions} />
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <CrsNumberCard crsScore={model.crsScore} />
        </div>
      </div>
      <div className="pw-entry pw-entry-delay-2">
        <JourneyPhaseStrip
          phase={model.journeyPhase}
          pathwayTitle={null}
          pathwayAsks={[]}
        />
      </div>
    </>
  );
}

function ExecutingLayout({ model }: { model: MissionControlModel }) {
  return (
    <>
      <div className="pw-entry">
        <StatusHero
          firstName={model.firstName}
          pathwayTitle={model.pathwayTitle}
          crsScore={model.crsScore}
          latestDraw={model.latestDraw}
          crsGap={model.crsGap}
        />
      </div>
      <div
        className="pw-entry pw-entry-delay-1"
        style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}
      >
        <div style={{ flex: '1.4 1 340px', minWidth: 0, display: 'flex' }}>
          <NextBestActionCard actions={model.actions} />
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex' }}>
          <CrsGaugeCard
            crsScore={model.crsScore}
            latestDraw={model.latestDraw}
            crsGap={model.crsGap}
            levers={model.levers}
          />
        </div>
      </div>
      {/* FSW-family pathways carry a second, independent eligibility gate (the
          67-point selection grid) alongside CRS ranking. Shown as an addendum
          below the CRS card — never swapped in for it — so a pass here can
          never read as contradicting the CRS position above. Absent for every
          other pathway family, which has no equivalent grid. */}
      {model.isFswPathway && model.fswEstimate !== null && (
        <div className="pw-entry pw-entry-delay-1">
          <FswEligibilityCard estimate={model.fswEstimate} />
        </div>
      )}
      <div className="pw-entry pw-entry-delay-2">
        <JourneyPhaseStrip
          phase={model.journeyPhase}
          pathwayTitle={model.pathwayTitle}
          pathwayAsks={model.pathwayAsks}
        />
      </div>
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

/**
 * Mission-control dashboard: synthesizes state, CRS position, next best
 * action, and journey awareness from the DashboardData payload. Full
 * primitives (stepper, checklists, document lists) live on their own tabs.
 */
export function DashboardMissionControl({ data }: { data: DashboardData }) {
  const model = deriveMissionControl(data);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {model.state === 'onboarding' && <FinishProfileCta firstName={model.firstName} />}
      {model.state === 'discovering' && <DiscoveringLayout model={model} />}
      {model.state === 'executing' && <ExecutingLayout model={model} />}
    </div>
  );
}
