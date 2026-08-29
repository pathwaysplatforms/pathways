'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivePathwayTracker } from './ActivePathwayTracker';
import { StepDetailDrawer } from './StepDetailDrawer';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext } from '@/modules/dashboard/types';

interface TrackedPathway {
  slug: string;
  title: string;
  processingTime: string | null;
}

interface PathwayTrackerSectionProps {
  pathway: TrackedPathway | null;
  steps: EnrichedApplicationStep[];
  documents: DashboardDocument[];
  pathwaySlug: string | null;
  applicationId: string | null;
  profileContext: ProfileContext;
}

/** Client wrapper that adds step-click drawer behaviour to ActivePathwayTracker. */
export function PathwayTrackerSection({
  pathway,
  steps,
  documents,
  pathwaySlug,
  applicationId,
  profileContext,
}: PathwayTrackerSectionProps) {
  const [selectedStep, setSelectedStep] = useState<EnrichedApplicationStep | null>(null);
  const router = useRouter();

  const handleClose = () => {
    setSelectedStep(null);
    router.refresh();
  };

  return (
    <>
      <ActivePathwayTracker
        pathway={pathway}
        steps={steps}
        onStepClick={setSelectedStep}
      />
      {selectedStep !== null && (
        <StepDetailDrawer
          step={selectedStep}
          documents={documents}
          pathwaySlug={pathwaySlug}
          applicationId={applicationId}
          profileContext={profileContext}
          onClose={handleClose}
        />
      )}
    </>
  );
}
