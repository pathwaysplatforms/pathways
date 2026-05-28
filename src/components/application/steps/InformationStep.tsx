import type { ApplicationStep } from '@/modules/pathways/types';

interface Props {
  step: ApplicationStep;
}

/** Stub — renders a placeholder until profile form fields are finalised. */
export function InformationStep({ step: _step }: Props) {
  return (
    <div>
      <p className="label-eyebrow mb-3">Information Required</p>
      <div className="rounded-card bg-bg-subtle p-4">
        <p className="text-text-secondary" style={{ fontSize: '14px', lineHeight: '1.6' }}>
          This step requires you to provide or confirm information from your profile.
          Form fields will appear here once the profile schema is finalised.
        </p>
      </div>
    </div>
  );
}
