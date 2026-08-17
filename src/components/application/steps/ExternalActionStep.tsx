'use client';

import { ExternalLink } from 'lucide-react';
import type { ApplicationStep } from '@/modules/pathways/types';
import { updateStepProgress } from '@/app/actions/progress';

interface Props {
  step: ApplicationStep;
  applicationId: string;
  pathwaySlug: string;
  isConfirmed: boolean;
  onConfirm: (confirmed: boolean) => void;
}

/** Renders instructions for an off-platform action plus a confirmation checkbox. */
export function ExternalActionStep({ step, applicationId: _applicationId, pathwaySlug, isConfirmed, onConfirm }: Props) {
  const portalResource = step.resources?.find((r) => r.type === 'official') ?? step.resources?.[0];
  const portalUrl = portalResource?.url ?? null;
  const portalLabel = portalResource?.label ?? 'Open official portal';

  const handleChange = async (checked: boolean) => {
    onConfirm(checked);
    if (checked) {
      await updateStepProgress({ stepId: step.id, pathwaySlug, status: 'complete' });
    }
  };

  return (
    <div>
      <p className="label-eyebrow mb-3">What you need to do</p>

      <div className="rounded-card bg-bg-subtle p-4 mb-5">
        <p className="text-text-secondary" style={{ fontSize: '14px', lineHeight: '1.6' }}>
          {step.description}
        </p>
        {portalUrl && (
          <div className="flex items-center gap-2 mt-3">
            <ExternalLink size={14} className="text-accent-500 flex-shrink-0" />
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-600 hover:text-accent-500 transition-colors"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              {portalLabel} →
            </a>
          </div>
        )}
        {step.resources && step.resources.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {step.resources.slice(1).map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-tertiary hover:text-text-secondary transition-colors"
                style={{ fontSize: '12px' }}
              >
                {r.label} ↗
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            className="sr-only"
            checked={isConfirmed}
            onChange={(e) => handleChange(e.target.checked)}
          />
          <div
            className={[
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              isConfirmed
                ? 'bg-accent-500 border-accent-500'
                : 'bg-bg-surface border-border group-hover:border-accent-300',
            ].join(' ')}
          >
            {isConfirmed && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                <path
                  d="M1 4L3.5 6.5L9 1.5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
        <p className="text-text-secondary" style={{ fontSize: '14px', lineHeight: '1.5' }}>
          I confirm I have completed this step outside of the app and am ready to continue.
        </p>
      </label>
    </div>
  );
}
