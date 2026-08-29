import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import type { ApplicationStep } from '@/modules/pathways/types';

interface Props {
  step: ApplicationStep;
  allSteps: ApplicationStep[];
}

const TYPE_LABELS: Record<string, string> = {
  document_upload: 'Document upload',
  information:     'Information',
  external_action: 'External action',
  review:          'Review',
};

/** Pre-submission review panel showing step-by-step completion status. */
export function ReviewStep({ step: _step, allSteps }: Props) {
  const nonReviewSteps = allSteps.filter((s) => s.type !== 'review');
  const completedCount = nonReviewSteps.filter((s) => s.status === 'completed').length;
  const totalCount = nonReviewSteps.length;
  const allComplete = completedCount === totalCount;

  return (
    <div>
      <p className="label-eyebrow mb-3">Application Summary</p>

      {/* Completion banner */}
      <div
        className={`rounded-card p-4 mb-5 flex items-start gap-3 ${
          allComplete ? 'bg-accent-50 border border-accent-100' : 'bg-bg-subtle border border-border-light'
        }`}
      >
        {allComplete ? (
          <CheckCircle2 size={20} className="text-accent-500 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle size={20} className="text-warning-500 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
        )}
        <div>
          <p className="text-text-primary" style={{ fontSize: '14px', fontWeight: 500 }}>
            {allComplete
              ? 'All steps complete — ready to submit'
              : `${completedCount} of ${totalCount} steps complete`}
          </p>
          <p className="text-text-secondary mt-0.5" style={{ fontSize: '13px' }}>
            {allComplete
              ? 'Review your application below before clicking Finish.'
              : 'Return to incomplete steps above before submitting.'}
          </p>
        </div>
      </div>

      {/* Step checklist */}
      <div className="flex flex-col gap-2">
        {nonReviewSteps.map((s) => {
          const done = s.status === 'completed';
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-card border border-border-light bg-bg-surface"
            >
              {done ? (
                <CheckCircle2 size={16} className="text-accent-500 flex-shrink-0" />
              ) : (
                <Circle size={16} className="text-text-disabled flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={done ? 'text-text-tertiary' : 'text-text-primary'}
                  style={{ fontSize: '13px', textDecoration: done ? 'line-through' : 'none' }}
                >
                  {s.title}
                </p>
              </div>
              <span
                className="label-eyebrow flex-shrink-0"
                style={{ color: done ? 'var(--color-text-disabled)' : undefined }}
              >
                {TYPE_LABELS[s.type] ?? s.type}
              </span>
            </div>
          );
        })}
      </div>

      {!allComplete && (
        <p className="text-text-tertiary mt-4" style={{ fontSize: '12px', lineHeight: '1.6' }}>
          Complete all steps to unlock the final submission. Use the Back button to return to any incomplete step.
        </p>
      )}
    </div>
  );
}
