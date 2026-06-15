'use client';

/*
 * AUDIT FINDINGS (2026-06-09):
 * - selected_pathway_slug: new column added via migration 20260609000001
 * - Steps come from pathway_steps table (no steps column on pathways)
 * - pathway_progress table does not exist yet — all steps default to 'upcoming'
 *   except the first, which is 'current'
 * - No shadow on cards — uses inline border only (spec: 1px solid #E5E5E5)
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/fx/AnimatedNumber';
import type { EnrichedApplicationStep } from '@/modules/dashboard/types';

interface TrackedPathway {
  slug: string;
  title: string;
  processingTime: string | null;
}

interface ActivePathwayTrackerProps {
  pathway: TrackedPathway | null;
  steps: EnrichedApplicationStep[];
  /** When provided, step rows become clickable and open the step detail drawer. */
  onStepClick?: (step: EnrichedApplicationStep) => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Progress bar that animates its fill width on mount. */
function ProgressBar({ pct }: { pct: number }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        height: 1,
        width: '100%',
        background: '#F3F4F6',
        borderRadius: 1,
        overflow: 'hidden',
        margin: '14px 0 0',
      }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        ref={fillRef}
        style={{
          height: '100%',
          background: '#1A56DB',
          width: ready ? `${pct}%` : '0%',
          transition: ready
            ? `width 600ms cubic-bezier(${EASE.join(',')})`
            : 'none',
        }}
      />
    </div>
  );
}

function StepStatusChip({ status }: { status: EnrichedApplicationStep['status'] }) {
  const styles: Record<
    EnrichedApplicationStep['status'],
    { bg: string; color: string; label: string }
  > = {
    upcoming: { bg: '#F3F4F6', color: '#6B7280', label: 'To do' },
    current:  { bg: '#EFF6FF', color: '#1A56DB', label: 'In progress' },
    complete: { bg: '#F0FDF4', color: '#16A34A', label: 'Done' },
  };
  const s = styles[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 9999,
        background: s.bg,
        color: s.color,
        fontFamily: 'var(--pw-font-ui)',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

function StepCircle({ status }: { status: EnrichedApplicationStep['status'] }) {
  if (status === 'complete') {
    return (
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#1A56DB',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* white checkmark */}
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1.5px solid #1A56DB',
          background: 'transparent',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: '1.5px solid #E5E5E5',
        background: 'transparent',
        flexShrink: 0,
      }}
    />
  );
}

/** Displays the user's selected pathway title, animated progress bar, and step list. */
export function ActivePathwayTracker({ pathway, steps, onStepClick }: ActivePathwayTrackerProps) {
  if (!pathway) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E5E5',
          borderRadius: 12,
          padding: '28px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: '#6B7280',
            marginBottom: 16,
          }}
        >
          You haven&apos;t selected a pathway yet.
        </p>
        <Link
          href="/onboarding/matches"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--pw-font-body)',
            fontSize: 14,
            color: '#1A56DB',
            textDecoration: 'none',
          }}
        >
          View your matches →
        </Link>
      </div>
    );
  }

  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const pct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px 0',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: 20,
              fontWeight: 400,
              color: 'var(--pw-ink)',
              lineHeight: 1.25,
              margin: 0,
            }}
          >
            {pathway.title}
          </p>
          {pathway.processingTime && (
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 12,
                color: '#6B7280',
                marginTop: 3,
              }}
            >
              Est. processing: {pathway.processingTime}
            </p>
          )}
        </div>
        <Link
          href="/onboarding/matches"
          style={{
            fontFamily: 'var(--pw-font-body)',
            fontSize: 12,
            color: '#6B7280',
            textDecoration: 'none',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Change pathway →
        </Link>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 24px' }}>
        <ProgressBar pct={pct} />
        <p
          style={{
            fontFamily: 'var(--pw-font-ui)',
            fontSize: 11,
            color: '#6B7280',
            textAlign: 'right',
            margin: '6px 0 0',
          }}
        >
          <AnimatedNumber value={pct} suffix="%" startInView={false} /> complete
        </p>
      </div>

      {/* Steps */}
      {steps.length === 0 ? (
        <div style={{ padding: '20px 24px 24px' }}>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 14,
              color: '#6B7280',
              textAlign: 'center',
            }}
          >
            Your pathway roadmap is being prepared.
          </p>
        </div>
      ) : (
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((step) => {
            const isCurrent = step.status === 'current';
            const textColor =
              step.status === 'upcoming' ? '#9CA3AF' : '#0A0A0A';
            const clickable = !!onStepClick;

            return (
              <div
                key={step.id}
                className={clickable ? 'pw-focus' : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onStepClick(step) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick(step); } : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0 10px 10px',
                  borderLeft: isCurrent ? '2px solid #1A56DB' : '2px solid transparent',
                  marginLeft: -2,
                  cursor: clickable ? 'pointer' : 'default',
                  borderRadius: clickable ? 6 : undefined,
                  transition: clickable ? 'background 120ms' : undefined,
                }}
                onMouseEnter={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; } : undefined}
                onMouseLeave={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } : undefined}
              >
                <StepCircle status={step.status} />
                <p
                  style={{
                    fontFamily: 'var(--pw-font-body)',
                    fontSize: 14,
                    color: textColor,
                    margin: 0,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {step.label}
                </p>
                <StepStatusChip status={step.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
