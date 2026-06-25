import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getDashboardData } from '@/modules/dashboard/service';
import { DashboardHomeLayout } from '@/components/dashboard/DashboardHomeLayout';
import { DemoStateBar } from '@/components/demo/DemoStateBar';
import { GradientBackground } from '@/components/ui/paper-design-shader-background';
import { resetOnboarding } from '@/app/actions/onboarding';

/** Server component: authenticates the user, fetches dashboard data, renders shell. */
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
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
    );
  }

  logger.info({ action: 'dashboard.complete', userId: user.id, state: dashboardData.state });

  return (
    <>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Ambient gradient: pinned behind content via sticky+height:0 trick */}
        <div style={{ position: 'sticky', top: 0, height: 0, zIndex: 0, flexShrink: 0 }} aria-hidden="true">
          <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            <GradientBackground />
          </div>
        </div>

        {/* Stepper-anchored 3-column layout — flex-fill so it claims viewport height */}
        <div className="flex-1 min-h-0 flex flex-col relative z-[1]" style={{ padding: '28px 28px 20px' }}>
          <DashboardHomeLayout data={dashboardData} />
        </div>

        {/* Ask Pathways entry point — position:relative + z-index:1 keeps it above the sticky gradient (z:0) */}
        <div style={{ padding: '0 28px 12px', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <Link
            href="/dashboard/ask"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--pw-font-body)',
              fontSize: 14,
              color: 'var(--pw-accent)',
              textDecoration: 'none',
              padding: '11px 18px',
              border: '1px solid rgba(26, 86, 219, 0.18)',
              borderRadius: 8,
              background: 'rgba(26, 86, 219, 0.04)',
            }}
          >
            <span>Ask Pathways</span>
            <span aria-hidden="true" style={{ fontSize: 16 }}>→</span>
          </Link>
        </div>

        <div className="flex justify-center pb-7" style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
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
      {process.env.NEXT_PUBLIC_DEMO_ENABLED === 'true' && (
        <DemoStateBar currentState={dashboardData.state} />
      )}
    </>
  );
}
