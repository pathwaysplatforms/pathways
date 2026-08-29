import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';

/** GET /api/account/tab-data — account data for the Profile/Settings modal. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.account.tabData.start' });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return Response.json(
        { error: { code: 'AUTH_ERROR', message: 'Not authenticated.' } },
        { status: 401 },
      );
    }

    const data = {
      email: user.email ?? '',
      lastSignInAt: user.last_sign_in_at ?? null,
      createdAt: user.created_at,
    };

    log.info({ action: 'api.account.tabData.complete' });
    return Response.json({ data, userEmail: user.email ?? '' });
  } catch (err) {
    log.error({ action: 'api.account.tabData.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load account data.' } },
      { status: 500 },
    );
  }
}
