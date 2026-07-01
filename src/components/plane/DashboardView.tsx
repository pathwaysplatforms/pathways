'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DashboardHomeLayout } from '@/components/dashboard/DashboardHomeLayout';
import { DemoStateBar } from '@/components/demo/DemoStateBar';
import { resetOnboarding } from '@/app/actions/onboarding';
import type { DashboardData } from '@/modules/dashboard/types';

interface DashboardViewProps {
  isActive: boolean;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: DashboardData }
  | { status: 'error' };

/** Plane slot 0 — Dashboard home. Fetches data on first activation. */
export function DashboardView({ isActive }: DashboardViewProps) {
  const hasFetchedRef = useRef(false);
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' });

  useEffect(() => {
    if (!isActive || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    let cancelled = false;

    async function load() {
      setFetchState({ status: 'loading' });
      try {
        const res = await fetch('/api/dashboard/data');
        if (cancelled) return;
        if (!res.ok) { setFetchState({ status: 'error' }); return; }
        const json = (await res.json()) as { data: DashboardData };
        if (!cancelled) setFetchState({ status: 'ok', data: json.data });
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
            We couldn&apos;t load your dashboard. Please try again.
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

  const { data } = fetchState;

  return (
    <div className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div
        className="flex-1 min-h-0 flex flex-col relative z-[1]"
        style={{ padding: '40px 32px 20px', width: '100%', maxWidth: 1200, margin: '0 auto' }}
      >
        <DashboardHomeLayout data={data} />
      </div>

      <div style={{ padding: '0 32px 12px', flexShrink: 0, position: 'relative', zIndex: 1, width: '100%', maxWidth: 1200, margin: '0 auto' }}>
        <Link
          href="/dashboard/ask"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--pw-font-body)', fontSize: 14, color: 'var(--pw-accent)',
            textDecoration: 'none', padding: '11px 18px',
            border: '1px solid rgba(26, 86, 219, 0.18)', borderRadius: 8,
            background: 'rgba(26, 86, 219, 0.04)',
          }}
        >
          <span>Ask Pathways</span>
          <span aria-hidden="true" style={{ fontSize: 16 }}>→</span>
        </Link>
      </div>

      <div className="flex justify-center pb-12" style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <form action={resetOnboarding}>
          <button
            type="submit"
            className="pw-redo-link text-sm underline underline-offset-4"
            style={{ fontFamily: 'var(--pw-font-body)', color: 'var(--pw-muted)' }}
          >
            Redo my onboarding profile
          </button>
        </form>
      </div>

      {process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true' && (
        <DemoStateBar currentState={data.state} />
      )}
    </div>
  );
}
