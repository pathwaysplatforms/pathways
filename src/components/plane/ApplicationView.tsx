'use client';

import { useEffect, useRef, useState } from 'react';
import { ApplicationPageClient } from '@/components/dashboard/ApplicationPageClient';
import type { EnrichedApplicationStep, DashboardDocument, ProfileContext } from '@/modules/dashboard/types';

interface ApplicationViewProps {
  isActive: boolean;
}

interface ApplicationApiData {
  pathway: {
    title: string;
    officialName: string;
    slug: string;
    processingTime: string;
    totalSteps: number;
    description: string;
  };
  steps: EnrichedApplicationStep[];
  profileContext: ProfileContext;
  documents: DashboardDocument[];
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: ApplicationApiData | null; profileContext: ProfileContext | null }
  | { status: 'error' };

/** Plane slot 1 — Application tracker. Fetches data on first activation. */
export function ApplicationView({ isActive }: ApplicationViewProps) {
  const hasFetchedRef = useRef(false);
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' });

  useEffect(() => {
    if (!isActive || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    let cancelled = false;

    async function load() {
      setFetchState({ status: 'loading' });
      try {
        const res = await fetch('/api/application/data');
        if (cancelled) return;
        if (!res.ok) { setFetchState({ status: 'error' }); return; }
        const json = (await res.json()) as {
          data: ApplicationApiData | null;
          profileContext: ProfileContext | null;
        };
        if (!cancelled) setFetchState({ status: 'ok', data: json.data, profileContext: json.profileContext ?? null });
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
        <div style={{ maxWidth: 400, textAlign: 'center', padding: '32px 28px', borderRadius: 12 }}>
          <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.5rem', color: '#0D0D0D', marginBottom: 8 }}>
            Something went wrong
          </p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#6B6B6B', marginBottom: 20 }}>
            We couldn&apos;t load your application. Please try again.
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

  if (!fetchState.data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <div style={{ maxWidth: 400, textAlign: 'center', padding: '32px 28px', borderRadius: 12 }}>
          <p style={{ fontFamily: 'var(--pw-font-display)', fontSize: '1.5rem', color: '#0D0D0D', marginBottom: 8 }}>
            No active application
          </p>
          <p style={{ fontFamily: 'var(--pw-font-body)', fontSize: 14, color: '#6B6B6B' }}>
            Complete onboarding to get matched to a pathway and start your application.
          </p>
        </div>
      </div>
    );
  }

  const { data } = fetchState;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ApplicationPageClient
        pathway={data.pathway}
        steps={data.steps}
        profileContext={data.profileContext}
        documents={data.documents}
      />
    </div>
  );
}
