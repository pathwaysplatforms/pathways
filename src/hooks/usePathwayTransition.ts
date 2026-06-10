'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { selectPathway } from '@/app/actions/pathway';

/** Shared transition hook used by both the pathway card button and MatchesCTA. */
export function usePathwayTransition() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      const raf = requestAnimationFrame(() => setOverlayVisible(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isTransitioning]);

  async function trigger(slug: string | null) {
    if (isTransitioning) return;
    setIsTransitioning(true);
    if (slug) {
      await selectPathway(slug);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    router.push('/dashboard');
    router.refresh();
  }

  return { trigger, isTransitioning, overlayVisible };
}
