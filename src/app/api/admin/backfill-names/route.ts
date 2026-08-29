import { type NextRequest } from 'next/server';
import { createRequestLogger } from '@/lib/logger';
import { backfillFullName } from '@/app/actions/backfillFullName';
import { constantTimeEqual } from '@/lib/constant-time';
import { PathwaysError } from '@/lib/errors';

/**
 * One-shot admin endpoint to backfill profiles.full_name from voice_session_data.
 * Requires X-Admin-Secret header matching ADMIN_SECRET env var.
 * POST /api/admin/backfill-names
 */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.admin.backfill-names.start' });

  const adminSecret = process.env.ADMIN_SECRET;
  const provided = req.headers.get('x-admin-secret');

  if (!adminSecret || !provided || !constantTimeEqual(provided, adminSecret)) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing X-Admin-Secret header.' } },
      { status: 401 }
    );
  }

  try {
    const result = await backfillFullName();
    log.info({ action: 'api.admin.backfill-names.done', ...result });
    return Response.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PathwaysError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: 500 }
      );
    }
    log.error({ action: 'api.admin.backfill-names.error', error: String(error) });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Backfill failed.' } },
      { status: 500 }
    );
  }
}
