import type { ApplicationStep } from '@/modules/pathways/types';

interface Props {
  step: ApplicationStep;
}

/** Stub — renders placeholder summary until previous steps are completeable. */
export function ReviewStep({ step: _step }: Props) {
  return (
    <div>
      <p className="label-eyebrow mb-3">Review Checklist</p>
      <div className="rounded-card bg-bg-subtle p-4">
        <p className="text-text-secondary" style={{ fontSize: '14px', lineHeight: '1.6' }}>
          Review your submitted documents and information before sending your application.
          The complete summary will appear here once previous steps are finished.
        </p>
      </div>
    </div>
  );
}
