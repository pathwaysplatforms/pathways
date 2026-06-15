import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getDashboardData } from '@/modules/dashboard/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { PathwayTrackerSection } from '@/components/dashboard/PathwayTrackerSection';
import { DemoStateBar } from '@/components/demo/DemoStateBar';
import { ParticleField } from '@/components/fx/ParticleField';
import { Suspense } from 'react';
import { resetOnboarding } from '@/app/actions/onboarding';

/** Server component: authenticates the user, fetches dashboard data, renders shell. */
export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `dashboard-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);

  logger.info({ action: 'dashboard.start', userId: user.id });

  let dashboardData;
  try {
    dashboardData = await getDashboardData(user.id, logger);
  } catch (err) {
    logger.error({ action: 'dashboard.error', userId: user.id, err });
    return (
      <DashboardShell avatarInitials="?" firstName="">
        <div className="flex flex-1 items-center justify-center p-7">
          <div className="card max-w-md w-full text-center">
            <h2 className="card-title mb-2">Something went wrong</h2>
            <p className="text-sm text-text-secondary mb-4">
              We couldn&apos;t load your dashboard. Please try again.
            </p>
            <a
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '9px 20px',
                fontFamily: 'var(--pw-font-body)',
                fontSize: '14px',
                fontWeight: 500,
                color: '#fff',
                background: 'var(--pw-ink)',
                borderRadius: '9999px',
                textDecoration: 'none',
              }}
            >
              Retry
            </a>
          </div>
        </div>
      </DashboardShell>
    );
  }

  logger.info({ action: 'dashboard.complete', userId: user.id, state: dashboardData.state });

  // Derive selected pathway for the tracker (null when an application already exists)
  const selectedPathway =
    dashboardData.selectedPathwaySlug && dashboardData.selectedPathwayTitle
      ? {
          slug: dashboardData.selectedPathwaySlug,
          title: dashboardData.selectedPathwayTitle,
          processingTime: dashboardData.selectedPathwayProcessingTime,
        }
      : null;

  return (
    <>
      <DashboardShell
        avatarInitials={dashboardData.avatarInitials}
        firstName={dashboardData.firstName}
        applicationId={dashboardData.applicationId}
      >
        {/*
         * Scroll wrapper: DashboardGrid is fixed at viewport height so the existing
         * layout is unchanged. ActivePathwayTracker appears below and is accessible
         * by scrolling. TopNav is h-16 (64px).
         */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Particle texture pinned to the scroll viewport, behind the cards */}
          <div style={{ position: 'sticky', top: 0, height: 0, zIndex: 0, flexShrink: 0 }} aria-hidden="true">
            <ParticleField
              density={0.45}
              opacity={0.04}
              parallax={8}
              style={{ inset: 'auto', top: 0, left: 0, width: '100%', height: 'calc(100vh - 64px)' }}
            />
          </div>

          {/* Grid occupies exactly the available viewport height */}
          <div
            style={{
              height: 'calc(100vh - 64px)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <Suspense fallback={<DashboardSkeleton />}>
              <DashboardGrid data={dashboardData} />
            </Suspense>
          </div>

          {/* Pathway tracker — full-width section below the grid */}
          <div style={{ padding: '0 28px 28px', flexShrink: 0 }}>
            <PathwayTrackerSection
              pathway={selectedPathway}
              steps={dashboardData.selectedPathwaySteps}
              documents={dashboardData.documents}
              pathwaySlug={dashboardData.selectedPathwaySlug}
              applicationId={dashboardData.applicationId}
              profileContext={dashboardData.profileContext}
            />
          </div>

          <div className="flex justify-center pb-7" style={{ flexShrink: 0 }}>
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
        </div>
      </DashboardShell>
      {process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true' && (
        <DemoStateBar currentState={dashboardData.state} />
      )}
    </>
  );
}
