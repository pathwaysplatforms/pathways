'use client';

import type { DashboardData } from '@/modules/dashboard/types';
import { MyPathwayCard } from './cards/MyPathwayCard';
import { ApplicationCard } from './cards/ApplicationCard';
import { StepTrackerCard } from './cards/StepTrackerCard';
import { RecommendationsCard } from './cards/RecommendationsCard';
import { DocumentsCard } from './cards/DocumentsCard';

interface DashboardGridProps {
  data: DashboardData;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getBadgeClass(state: DashboardData['state']): string {
  switch (state) {
    case 'onboarding_incomplete': return 'badge badge-warning';
    case 'pathway_not_selected':  return 'badge badge-info';
    case 'application_in_progress': return 'badge badge-progress';
    case 'application_submitted': return 'badge badge-success';
  }
}

function getStateBadgeLabel(state: DashboardData['state']): string {
  switch (state) {
    case 'onboarding_incomplete': return 'Action needed';
    case 'pathway_not_selected':  return 'Choose a pathway';
    case 'application_in_progress': return 'In progress';
    case 'application_submitted': return 'Complete';
  }
}

/**
 * Client component that renders the 3-column dashboard bento grid.
 * Receives all data from the server page component.
 */
export function DashboardGrid({ data }: DashboardGridProps) {
  const greeting = getGreeting();
  const dateStr = formatDate();

  return (
    <div className="flex flex-col gap-5 p-7">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-text-primary"
            style={{ fontFamily: 'Urbanist, sans-serif', fontWeight: 700, fontSize: '20px' }}
          >
            {greeting}, {data.firstName}
          </p>
          <p className="text-text-tertiary" style={{ fontSize: '13px' }}>{dateStr}</p>
        </div>
        <span className={getBadgeClass(data.state)}>
          {getStateBadgeLabel(data.state)}
        </span>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Col 1 — MyPathwayCard + ApplicationCard */}
        <div className="flex flex-col gap-5">
          <MyPathwayCard data={data} />
          <ApplicationCard data={data} />
        </div>

        {/* Col 2 — StepTrackerCard (full height) */}
        <StepTrackerCard data={data} />

        {/* Col 3 — RecommendationsCard + DocumentsCard */}
        <div className="flex flex-col gap-5">
          <div className="flex-1">
            <RecommendationsCard data={data} />
          </div>
          <DocumentsCard data={data} />
        </div>
      </div>
    </div>
  );
}
