import { CheckCircle2, Circle, Lock } from 'lucide-react';
import type { ApplicationStep } from '@/modules/pathways/types';

interface Props {
  steps: ApplicationStep[];
  currentStepIdx: number;
}

type DisplayStatus = 'completed' | 'current' | 'upcoming' | 'blocked';

function getDisplayStatus(step: ApplicationStep, idx: number, currentIdx: number): DisplayStatus {
  if (step.status === 'blocked') return 'blocked';
  if (idx < currentIdx) return 'completed';
  if (idx === currentIdx) return 'current';
  return 'upcoming';
}

/** Sticky right-column card listing all steps with live status indicators. */
export function ProgressTracker({ steps, currentStepIdx }: Props) {
  const pct = Math.round((currentStepIdx / steps.length) * 100);

  return (
    <div
      className="bg-bg-surface rounded-card border border-border-light sticky top-6 self-start"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border-light">
        <div className="flex items-center justify-between mb-3">
          <p className="card-title">Your Progress</p>
          <span className="text-accent-500 font-semibold" style={{ fontSize: '14px' }}>
            {pct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="px-3 py-3">
        {steps.map((step, idx) => {
          const status: DisplayStatus = getDisplayStatus(step, idx, currentStepIdx);
          const isCurrent = status === 'current';
          const isCompleted = status === 'completed';
          const isBlocked = status === 'blocked';

          return (
            <div
              key={step.id}
              className={[
                'flex items-center gap-2.5 px-2 py-1.5 rounded-icon transition-colors',
                isCurrent ? 'bg-accent-50' : '',
              ].join(' ')}
              style={isCurrent ? { borderLeft: '2px solid var(--color-accent-500)', paddingLeft: 6 } : {}}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isCompleted && (
                  <CheckCircle2 size={17} className="text-accent-500" />
                )}
                {isCurrent && (
                  <div
                    className="rounded-full bg-accent-500 flex items-center justify-center"
                    style={{ width: 17, height: 17 }}
                  >
                    <div className="w-[7px] h-[7px] rounded-full bg-white" />
                  </div>
                )}
                {!isCompleted && !isCurrent && !isBlocked && (
                  <Circle size={17} className="text-text-disabled" />
                )}
                {isBlocked && (
                  <Lock size={17} className="text-text-disabled" aria-label="Complete previous steps first" />
                )}
              </div>

              {/* Title */}
              <p
                className={[
                  'flex-1 min-w-0 truncate',
                  isCompleted ? 'text-text-tertiary line-through' : '',
                  isCurrent ? 'text-text-primary font-semibold' : '',
                  !isCompleted && !isCurrent ? 'text-text-tertiary' : '',
                ].join(' ')}
                style={{ fontSize: '12px' }}
              >
                {step.title}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-light">
        <button
          className="text-accent-600 hover:text-accent-500 transition-colors w-full text-left"
          style={{ fontSize: '13px', fontWeight: 500 }}
        >
          Need help?
        </button>
      </div>
    </div>
  );
}
