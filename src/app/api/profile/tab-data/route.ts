import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getProfileTabData } from '@/modules/profile/service';

/** GET /api/profile/tab-data — profile data for the Profile/Settings modal. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.profile.tabData.start' });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return Response.json(
        { error: { code: 'AUTH_ERROR', message: 'Not authenticated.' } },
        { status: 401 },
      );
    }

    const data = await getProfileTabData(user.id, log);
    log.info({ action: 'api.profile.tabData.complete' });
    return Response.json({ data });
  } catch (err) {
    log.error({ action: 'api.profile.tabData.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load profile data.' } },
      { status: 500 },
    );
  }
}
