import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getUserApplications } from '@/modules/application/service';

/** GET /api/application/list — every application the user has started, with
 *  step-completion progress, for the applications-home list. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.application.list.start' });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return Response.json(
        { error: { code: 'AUTH_ERROR', message: 'Not authenticated.' } },
        { status: 401 },
      );
    }

    const applications = await getUserApplications(user.id, log);

    log.info({ action: 'api.application.list.complete', count: applications.length });
    return Response.json({ applications });
  } catch (err) {
    log.error({ action: 'api.application.list.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load applications.' } },
      { status: 500 },
    );
  }
}
