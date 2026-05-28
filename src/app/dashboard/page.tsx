import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getDashboardData } from '@/modules/dashboard/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DemoStateBar } from '@/components/demo/DemoStateBar';
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
            <a href="/dashboard" className="btn-primary">
              Retry
            </a>
          </div>
        </div>
      </DashboardShell>
    );
  }

  logger.info({ action: 'dashboard.complete', userId: user.id, state: dashboardData.state });

  return (
    <>
      <DashboardShell
        avatarInitials={dashboardData.avatarInitials}
        firstName={dashboardData.firstName}
        applicationId={dashboardData.applicationId}
      >
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardGrid data={dashboardData} />
        </Suspense>
        <div className="flex justify-center pb-7">
          <form action={resetOnboarding}>
            <button
              type="submit"
              className="text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary transition-colors"
            >
              Redo my onboarding profile
            </button>
          </form>
        </div>
      </DashboardShell>
      {process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true' && (
        <DemoStateBar currentState={dashboardData.state} />
      )}
    </>
  );
}
