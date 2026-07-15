'use client';

import { DashboardMissionControl } from '@/components/dashboard/mission-control/DashboardMissionControl';
import { DemoStateBar } from '@/components/demo/DemoStateBar';
import { PlaneSpinner, PlaneError } from '@/components/plane/PlaneStatus';
import { PLANE_DATA_URLS } from '@/components/plane/urls';
import { usePlaneData } from '@/hooks/usePlaneData';
import { resetOnboarding } from '@/app/actions/onboarding';
import type { DashboardData } from '@/modules/dashboard/types';

interface DashboardViewProps {
  isActive: boolean;
}

/** Plane slot 0 — Dashboard home. Cached stale-while-revalidate; no spinner on return visits. */
export function DashboardView({ isActive }: DashboardViewProps) {
  const { state, retry } = usePlaneData<{ data: DashboardData }>(PLANE_DATA_URLS.dashboard, isActive);

  if (state.status === 'loading') return <PlaneSpinner />;
  if (state.status === 'error') {
    return <PlaneError message="We couldn't load your dashboard. Please try again." onRetry={retry} />;
  }

  const { data } = state.data;

  return (
    <div className="pw-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Natural height: pinning this box to the viewport (flex-1 min-h-0) let the
          mission-control content overflow it, painting the redo link over the journey
          card and burying the ask bar. The outer .pw-scroll owns all scrolling. */}
      <div
        className="relative z-[1]"
        style={{ padding: '40px 32px 20px', width: '100%', maxWidth: 1200, margin: '0 auto' }}
      >
        <DashboardMissionControl data={data} />
      </div>

      <div className="flex justify-center pb-12" style={{ position: 'relative', zIndex: 1 }}>
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
