'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Application } from '@/modules/pathways/types';
import { TopNav } from '@/components/dashboard/TopNav';
import { StepCard } from './StepCard';
import { ProgressTracker } from './ProgressTracker';

interface Props {
  application: Application;
  avatarInitials: string;
  firstName: string;
}

/** Interactive shell: full-viewport layout with step navigation state. */
export function ApplicationLayout({ application, avatarInitials, firstName }: Props) {
  const initialIdx = Math.max(
    0,
    application.steps.findIndex((s) => s.status === 'current'),
  );
  const [currentStepIdx, setCurrentStepIdx] = useState(initialIdx);

  const totalSteps = application.steps.length;
  const currentStep = application.steps[currentStepIdx];

  const handleNext = () => {
    if (currentStepIdx < totalSteps - 1) setCurrentStepIdx((i) => i + 1);
  };

  const handleBack = () => {
    if (currentStepIdx > 0) setCurrentStepIdx((i) => i - 1);
  };

  return (
    // overflow-y-auto on main (not overflow-hidden) so sticky tracker works
    <div className="h-screen flex flex-col bg-bg-base overflow-hidden">
      <TopNav
        avatarInitials={avatarInitials}
        firstName={firstName}
        applicationId={application.id}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Page header */}
          <div className="mb-7">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors mb-3"
              style={{ fontSize: '13px', fontWeight: 500 }}
            >
              ← My Dashboard
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-text-primary font-bold"
                style={{ fontSize: '24px', letterSpacing: '-0.01em' }}
              >
                {application.pathway.title}
              </h1>
              <span className="badge badge-progress">In Progress</span>
            </div>
            <p className="text-text-tertiary mt-1" style={{ fontSize: '13px' }}>
              {application.pathway.official_name}
            </p>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Left — active step card */}
            <div className="flex-1 min-w-0">
              <StepCard
                step={currentStep}
                stepNumber={currentStepIdx + 1}
                totalSteps={totalSteps}
                onNext={handleNext}
                onBack={handleBack}
                canGoBack={currentStepIdx > 0}
                canGoNext={currentStepIdx < totalSteps - 1}
              />
            </div>

            {/* Right — progress tracker */}
            <div className="w-full md:w-80 flex-shrink-0">
              <ProgressTracker
                steps={application.steps}
                currentStepIdx={currentStepIdx}
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
