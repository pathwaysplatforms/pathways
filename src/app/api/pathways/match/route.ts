import { createRequestLogger } from '@/lib/logger';
import { requireAuth, getProfile } from '@/modules/auth/service';
import { matchPathways } from '@/modules/pathways/service';
import { PathwaysError, AuthError } from '@/lib/errors';
import type { Logger } from 'pino';

function handleError(error: unknown, log: Logger): Response {
  if (error instanceof PathwaysError) {
    log.error({ action: 'api.pathways.match.error', code: error.code, message: error.message });
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    );
  }
  log.error({ action: 'api.pathways.match.error', error: String(error) });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
    { status: 500 },
  );
}

/** Returns ranked MatchResult[] for the authenticated user's profile. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.pathways.match.start' });

  try {
    await requireAuth();

    const profile = await getProfile();
    if (!profile) throw new AuthError('Profile not found');

    const matches = await matchPathways(profile.id, log);

    log.info({ action: 'api.pathways.match.done', count: matches.length });
    return Response.json({ matches });
  } catch (error) {
    return handleError(error, log);
  }
}
