'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DashboardView } from '@/components/plane/DashboardView';
import { ApplicationView } from '@/components/plane/ApplicationView';
import { DocumentsView } from '@/components/plane/DocumentsView';
import { PathwaysView } from '@/components/plane/PathwaysView';
import { DrawsView } from '@/components/plane/DrawsView';

// URL ↔ index mapping. Order is the plane index (0–4).
export const PLANE_PATHS = [
  '/dashboard',
  '/dashboard/application',
  '/dashboard/documents',
  '/dashboard/pathways',
  '/dashboard/draws',
] as const;

export type PlanePath = (typeof PLANE_PATHS)[number];

/** Resolve a pathname to a plane index; unknown paths map to 0. */
export function pathToIndex(pathname: string): number {
  const idx = PLANE_PATHS.indexOf(pathname as PlanePath);
  return idx === -1 ? 0 : idx;
}

interface NavigationPlaneProps {
  /** Controlled: current active slot (0–4). */
  activeIndex: number;
  /** Called when browser back/forward changes the active slot. */
  onPopState: (index: number) => void;
}

/** Sliding 5-slot plane. Slots never unmount — scroll state is preserved by the browser. */
export function NavigationPlane({ activeIndex, onPopState }: NavigationPlaneProps) {
  const isFirstRender = useRef(true);
  // While true, the track carries will-change:transform. At rest it is dropped so
  // the track establishes no stacking context and panel backdrop-filters can see
  // through to the fixed background layer.
  const [animating, setAnimating] = useState(false);

  // Turn on will-change synchronously before the slide paints; released on transitionend.
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setAnimating(true);
  }, [activeIndex]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName === 'transform') setAnimating(false);
  }, []);

  // Keep URL in sync with activeIndex.
  useEffect(() => {
    const targetPath = PLANE_PATHS[activeIndex];
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  }, [activeIndex]);

  // Respond to browser back / forward.
  useEffect(() => {
    function handlePopState() {
      onPopState(pathToIndex(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onPopState]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
      {/* 500%-wide track; each slot is 20% of the track = 100% of the viewport. */}
      <div
        className={`pw-plane-track${animating ? ' pw-plane-track--animating' : ''}`}
        onTransitionEnd={handleTransitionEnd}
        style={{
          display: 'flex',
          width: '500%',
          height: '100%',
          transform: `translateX(-${activeIndex * 20}%)`,
        }}
      >
        {([0, 1, 2, 3, 4] as const).map((i) => (
          <div
            key={i}
            style={{
              width: '20%',
              flexShrink: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Glass panel: content slots (1=application, 2=documents) use tighter margins. */}
            <div className={`pw-glass-panel${(i === 1 || i === 2) ? ' pw-glass-panel--content' : ''}`}>
              {i === 0 && <DashboardView isActive={activeIndex === 0} />}
              {i === 1 && <ApplicationView isActive={activeIndex === 1} />}
              {i === 2 && <DocumentsView isActive={activeIndex === 2} />}
              {i === 3 && <PathwaysView isActive={activeIndex === 3} />}
              {i === 4 && <DrawsView isActive={activeIndex === 4} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
