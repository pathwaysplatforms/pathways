'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPlaneData, getPlaneData } from '@/lib/plane-data';

export type PlaneDataState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error' };

interface UsePlaneDataOptions {
  /** Re-fetch in the background each time the view becomes active. Default: true. */
  revalidateOnActive?: boolean;
}

/**
 * Stale-while-revalidate data source for a plane view: serves the module cache
 * instantly when warm (no spinner on return visits) and revalidates in the
 * background on activation. A failed background revalidation keeps showing the
 * stale data rather than flashing an error.
 */
export function usePlaneData<T>(
  url: string,
  isActive: boolean,
  options: UsePlaneDataOptions = {},
): { state: PlaneDataState<T>; retry: () => void } {
  const { revalidateOnActive = true } = options;

  const [state, setState] = useState<PlaneDataState<T>>(() => {
    const cached = getPlaneData<T>(url);
    return cached === undefined ? { status: 'loading' } : { status: 'ok', data: cached };
  });

  // Monotonic token: only the most recent request may apply its result.
  const requestIdRef = useRef(0);

  const load = useCallback(
    (showSpinner: boolean) => {
      const id = ++requestIdRef.current;
      if (showSpinner) setState({ status: 'loading' });
      fetchPlaneData<T>(url)
        .then((data) => {
          if (requestIdRef.current === id) setState({ status: 'ok', data });
        })
        .catch(() => {
          if (requestIdRef.current !== id) return;
          setState((prev) => (prev.status === 'ok' ? prev : { status: 'error' }));
        });
    },
    [url],
  );

  useEffect(() => {
    if (!isActive) return;
    const cached = getPlaneData<T>(url);
    if (cached === undefined) {
      load(true);
    } else {
      setState({ status: 'ok', data: cached });
      if (revalidateOnActive) load(false);
    }
  }, [isActive, url, revalidateOnActive, load]);

  const retry = useCallback(() => load(true), [load]);

  return { state, retry };
}
