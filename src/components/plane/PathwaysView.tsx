'use client';

import { PathwayRecommendations } from '@/components/pathways/PathwayRecommendations';
import { useScrollFade } from '@/hooks/useScrollFade';

interface PathwaysViewProps {
  isActive: boolean;
}

/** Plane slot 3 — Pathway recommendations. Passes isActive to gate the initial fetch. */
export function PathwaysView({ isActive }: PathwaysViewProps) {
  const { ref: scrollRef, faded } = useScrollFade();
  return (
    <div className="pw-scroll-fade" data-faded={faded} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        className="pw-scroll min-h-full py-20 px-6"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', fontFamily: 'var(--pw-font-body)' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <p className="pw-eyebrow mb-3">Your results</p>
            <h1
              className="text-3xl md:text-4xl text-pw-ink mb-3 leading-tight"
              style={{ fontFamily: 'var(--pw-font-display)', fontWeight: 400 }}
            >
              Your top pathway matches
            </h1>
            <p className="text-sm text-pw-muted leading-relaxed">
              Based on your profile, here are the immigration programs you qualify for — ranked by fit.
            </p>
          </div>
          <hr className="pw-rule mb-10" />
          <PathwayRecommendations isActive={isActive} />
        </div>
      </div>
    </div>
  );
}
