'use client';

import { useEffect, useRef, useState } from 'react';
import { DrawsClient, type Draw } from '@/components/draws/DrawsClient';
import { useScrollFade } from '@/hooks/useScrollFade';

interface DrawsViewProps {
  isActive: boolean;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; draws: Draw[] }
  | { status: 'error' };

/** Plane slot 4 — Express Entry draws tracker. Fetches data on first activation. */
export function DrawsView({ isActive }: DrawsViewProps) {
  const hasFetchedRef = useRef(false);
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' });
  const { ref: scrollRef, faded } = useScrollFade();

  useEffect(() => {
    if (!isActive || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    let cancelled = false;

    async function load() {
      setFetchState({ status: 'loading' });
      try {
        const res = await fetch('/api/draws/data');
        if (cancelled) return;
        if (!res.ok) { setFetchState({ status: 'error' }); return; }
        const json = (await res.json()) as { draws: Draw[] };
        if (!cancelled) setFetchState({ status: 'ok', draws: json.draws });
      } catch {
        if (!cancelled) setFetchState({ status: 'error' });
      }
    }

    void load();
    return () => {
      cancelled = true;
      hasFetchedRef.current = false;
    };
  }, [isActive]);

  if (fetchState.status === 'idle' || fetchState.status === 'loading') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '2px solid rgba(0,0,0,0.08)',
            borderTopColor: 'var(--pw-ink)',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <div style={{ maxWidth: 400, textAlign: 'center', padding: '32px 28px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12 }}>
          <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.5rem', color: '#0D0D0D', marginBottom: 8 }}>
            Something went wrong
          </p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#6B6B6B', marginBottom: 20 }}>
            We couldn&apos;t load draws data. Please try again.
          </p>
          <button
            type="button"
            onClick={() => { hasFetchedRef.current = false; setFetchState({ status: 'idle' }); }}
            style={{
              display: 'inline-flex', alignItems: 'center', padding: '9px 20px',
              fontFamily: 'var(--pw-font-body)', fontSize: 14, fontWeight: 500,
              color: '#fff', background: '#0D0D0D', borderRadius: 9999, border: 'none', cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pw-scroll-fade" data-faded={faded} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <DrawsClient draws={fetchState.draws} />
      </div>
    </div>
  );
}
