'use client';

import { useState, useEffect } from 'react';
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
 * Manages entry animation visibility state and cascades it to child components.
 */
export function DashboardGrid({ data }: DashboardGridProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const entry = `pw-entry${isVisible ? ' is-visible' : ''}`;
  const entryRight = `pw-entry-right${isVisible ? ' is-visible' : ''}`;

  return (
    <div
      className="flex flex-1 min-h-0 overflow-hidden"
      style={{ gap: 14, padding: '20px 28px 28px' }}
    >
      {/* Left column: greeting + card row + map */}
      <div
        className="flex flex-col flex-1 min-h-0"
        style={{ gap: 14 }}
      >
        <GreetingHeader firstName={data.firstName} isVisible={isVisible} />

        {/* Two-card row — animates in together */}
        <div
          className={`grid grid-cols-2 flex-shrink-0 ${entry}`}
          style={{ gap: 14, height: 220, transitionDelay: '160ms' }}
        >
          {data.state === 'onboarding_incomplete'   && <OnboardingIncompleteGrid data={data} />}
          {data.state === 'pathway_not_selected'    && <PathwayNotSelectedGrid data={data} />}
          {data.state === 'pathway_selected'        && <ApplicationInProgressGrid data={data} />}
          {data.state === 'application_in_progress' && <ApplicationInProgressGrid data={data} />}
          {data.state === 'application_submitted'   && <ApplicationSubmittedGrid data={data} />}
        </div>

        {/* Map card — fills remaining vertical space */}
        <div
          className={`flex flex-col flex-1 min-h-0 ${entry}`}
          style={{ minHeight: 90, transitionDelay: '300ms' }}
        >
          <MapCard />
        </div>
      </div>

      {/* Right column: sidebar — slides in from right */}
      <div
        className={`flex flex-col min-h-0 flex-shrink-0 ${entryRight}`}
        style={{ width: '40%', maxWidth: 480, minWidth: 280, transitionDelay: '180ms' }}
      >
        <MyPathwayCard data={data} isVisible={isVisible} />
      </div>
    </div>
  );
}
