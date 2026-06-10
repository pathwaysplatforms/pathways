'use client';

import { usePathwayTransition } from '@/hooks/usePathwayTransition';

interface MatchesCTAProps {
  label: string;
  topPathwaySlug: string | null;
}

/** CTA button for the matches page — persists selected pathway, fades to white, navigates to /dashboard. */
export function MatchesCTA({ label, topPathwaySlug }: MatchesCTAProps) {
  const { trigger, isTransitioning, overlayVisible } = usePathwayTransition();

  async function handleClick() {
    await trigger(topPathwaySlug);
  }

  return (
    <>
      {/* Full-screen white fade overlay */}
      {isTransitioning && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#FFFFFF',
            zIndex: 50,
            pointerEvents: 'none',
            opacity: overlayVisible ? 1 : 0,
            transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      )}

      <button
        onClick={handleClick}
        disabled={isTransitioning}
        className="w-full py-3 rounded-full flex items-center justify-center gap-2 text-sm"
        style={{
          background: 'var(--pw-ink)',
          color: '#FFFFFF',
          fontFamily: 'var(--pw-font-body)',
          cursor: isTransitioning ? 'not-allowed' : 'pointer',
          border: 'none',
          transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
          opacity: isTransitioning ? 0.6 : 1,
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {isTransitioning ? (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'white',
              display: 'inline-block',
            }}
          />
        ) : (
          <>
            {label}
            <span aria-hidden="true">→</span>
          </>
        )}
      </button>
    </>
  );
}
