'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ApplicationPageClient } from '@/components/dashboard/ApplicationPageClient';
import { ApplicationsHomeView, type ApplicationSummary } from '@/components/dashboard/ApplicationsHomeView';
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
  crsScore: number | null;
}

type DetailFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: ApplicationApiData | null; profileContext: ProfileContext | null }
  | { status: 'error' };

type HomeFetchState =
  | { status: 'loading' }
  | { status: 'ok'; applications: ApplicationSummary[] }
  | { status: 'error' };

/** Plane slot 1 — Application tracker. Lands on the applications-home list;
 * selecting a card drills into that application's detail (sidebar + steps). */
export function ApplicationView({ isActive }: ApplicationViewProps) {
  const [view, setView] = useState<'home' | 'detail'>('home');
  const hasFetchedHomeRef = useRef(false);
  const [homeState, setHomeState] = useState<HomeFetchState>({ status: 'loading' });

  const hasFetchedDetailRef = useRef(false);
  const [detailState, setDetailState] = useState<DetailFetchState>({ status: 'idle' });
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    setHomeState({ status: 'loading' });
    try {
      const res = await fetch('/api/application/list');
      if (!res.ok) { setHomeState({ status: 'error' }); return; }
      const json = (await res.json()) as { applications: ApplicationSummary[] };
      setHomeState({ status: 'ok', applications: json.applications ?? [] });
    } catch {
      setHomeState({ status: 'error' });
    }
  }, []);

  const loadDetail = useCallback(async (slug: string) => {
    setDetailState({ status: 'loading' });
    try {
      const res = await fetch(`/api/application/data?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) { setDetailState({ status: 'error' }); return; }
      const json = (await res.json()) as {
        data: ApplicationApiData | null;
        profileContext: ProfileContext | null;
      };
      setDetailState({ status: 'ok', data: json.data, profileContext: json.profileContext ?? null });
    } catch {
      setDetailState({ status: 'error' });
    }
  }, []);

  // Fetch the home list once, the first time this tab becomes active.
  useEffect(() => {
    if (!isActive || hasFetchedHomeRef.current) return;
    hasFetchedHomeRef.current = true;
    void loadHome();
  }, [isActive, loadHome]);

  const handleSelectApplication = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setView('detail');
    hasFetchedDetailRef.current = true;
    void loadDetail(slug);
  }, [loadDetail]);

  const handleBackToHome = useCallback(() => {
    setView('home');
  }, []);

  if (view === 'home') {
    return (
      <ApplicationsHomeView
        status={homeState.status}
        applications={homeState.status === 'ok' ? homeState.applications : []}
        onSelect={handleSelectApplication}
        onRetry={() => { hasFetchedHomeRef.current = true; void loadHome(); }}
      />
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────

  if (detailState.status === 'idle' || detailState.status === 'loading') {
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

  if (detailState.status === 'error') {
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
            onClick={() => { if (selectedSlug) void loadDetail(selectedSlug); }}
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

  if (!detailState.data) {
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

  const { data } = detailState;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ApplicationPageClient
        pathway={data.pathway}
        steps={data.steps}
        profileContext={data.profileContext}
        documents={data.documents}
        crsScore={data.crsScore}
        onBack={handleBackToHome}
      />
    </div>
  );
}
