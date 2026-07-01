import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getDashboardData } from '@/modules/dashboard/service';

/** GET /api/dashboard/data — dashboard data for the NavigationPlane DashboardView. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.dashboard.data.start' });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return Response.json(
        { error: { code: 'AUTH_ERROR', message: 'Not authenticated.' } },
        { status: 401 },
      );
    }

    const data = await getDashboardData(user.id, log);
    log.info({ action: 'api.dashboard.data.complete', state: data.state });
    return Response.json({ data });
  } catch (err) {
    log.error({ action: 'api.dashboard.data.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard data.' } },
      { status: 500 },
    );
  }
}
