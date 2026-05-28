'use client';

import type { DashboardData } from '@/modules/dashboard/types';
import { GreetingHeader } from './GreetingHeader';
import { MapCard } from './MapCard';
import { MyPathwayCard } from './MyPathwayCard';
import { OnboardingIncompleteGrid } from './states/OnboardingIncompleteGrid';
import { PathwayNotSelectedGrid } from './states/PathwayNotSelectedGrid';
import { ApplicationInProgressGrid } from './states/ApplicationInProgressGrid';
import { ApplicationSubmittedGrid } from './states/ApplicationSubmittedGrid';

interface DashboardGridProps {
  data: DashboardData;
}

/**
 * Client component: renders the 2-column bento grid with greeting, card row, map, and pathway card.
 * Receives all data from the server page component.
 */
export function DashboardGrid({ data }: DashboardGridProps) {
  return (
    <div
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ gap: 24, padding: '20px 32px 32px' }}
    >
      {/* Left column: greeting + card row + map */}
      <div
        className="flex flex-col flex-1 min-h-0"
        style={{ gap: 20 }}
      >
        <GreetingHeader firstName={data.firstName} />

        {/* Two-card row — taller for better readability */}
        <div
          className="grid grid-cols-2 flex-shrink-0"
          style={{ gap: 20, height: 220 }}
        >
          {data.state === 'onboarding_incomplete'   && <OnboardingIncompleteGrid data={data} />}
          {data.state === 'pathway_not_selected'    && <PathwayNotSelectedGrid data={data} />}
          {data.state === 'application_in_progress' && <ApplicationInProgressGrid data={data} />}
          {data.state === 'application_submitted'   && <ApplicationSubmittedGrid data={data} />}
        </div>

        {/* Map card — fills remaining vertical space */}
        <div className="flex flex-col flex-1 min-h-0" style={{ minHeight: 90 }}>
          <MapCard />
        </div>
      </div>

      {/* Right column: MyPathway card — slightly narrower than left */}
      <div
        className="flex flex-col min-h-0 flex-shrink-0"
        style={{ width: '40%', maxWidth: 480, minWidth: 280 }}
      >
        <MyPathwayCard data={data} />
      </div>
    </div>
  );
}
