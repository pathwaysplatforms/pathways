'use client';

import { useEffect, useState } from 'react';

/** Returns true when the user has prefers-reduced-motion: reduce set; SSR-safe (false on server). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** Navigator augmented with the non-standard (Chromium-only) deviceMemory hint. */
interface NavigatorWithDeviceMemory extends Navigator {
  /** Approximate device RAM in GiB. Undefined outside Chromium. */
  deviceMemory?: number;
}

/**
 * Returns true when motion/effects should be suppressed entirely — either the
 * user requests reduced motion, or the device reports less than 4 GiB of RAM.
 * SSR-safe (false on the server; resolved after mount).
 */
export function useShouldReduceMotion(): boolean {
  const [shouldReduce, setShouldReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const nav = navigator as NavigatorWithDeviceMemory;
    const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4;

    const evaluate = (motionReduced: boolean) => setShouldReduce(motionReduced || lowMemory);
    evaluate(mq.matches);
    const onChange = (e: MediaQueryListEvent) => evaluate(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return shouldReduce;
}
