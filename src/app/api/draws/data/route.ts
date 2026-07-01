import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import type { Draw } from '@/components/draws/DrawsClient';

/** GET /api/draws/data — Express Entry draws list for the NavigationPlane DrawsView. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.draws.data.start' });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return Response.json(
        { error: { code: 'AUTH_ERROR', message: 'Not authenticated.' } },
        { status: 401 },
      );
    }

    const db = supabase as unknown as SupabaseClient;
    const { data: rawDraws, error: dbError } = await db
      .from('immigration_draws')
      .select('id, draw_date, draw_type, cutoff_score, invitations_issued, round_number, program')
      .eq('country', 'canada')
      .order('draw_date', { ascending: true });

    if (dbError) {
      log.error({ action: 'api.draws.data.dbError', error: dbError });
      return Response.json(
        { error: { code: 'DB_ERROR', message: dbError.message } },
        { status: 500 },
      );
    }

    const draws: Draw[] = (
      (rawDraws ?? []) as {
        id: string;
        draw_date: string;
        draw_type: string | null;
        cutoff_score: number | null;
        invitations_issued: number | null;
        round_number: number | null;
        program: string | null;
      }[]
    )
      .filter(
        (d): d is {
          id: string;
          draw_date: string;
          draw_type: string;
          cutoff_score: number;
          invitations_issued: number;
          round_number: number;
          program: string | null;
        } =>
          d.draw_type !== null &&
          d.cutoff_score !== null &&
          d.invitations_issued !== null &&
          d.round_number !== null,
      )
      .map(d => ({
        id: d.id,
        draw_date: d.draw_date,
        draw_type: d.draw_type,
        cutoff_score: d.cutoff_score,
        invitations_issued: d.invitations_issued,
        round_number: d.round_number,
        program: d.program,
      }));

    log.info({ action: 'api.draws.data.complete', count: draws.length });
    return Response.json({ draws });
  } catch (err) {
    log.error({ action: 'api.draws.data.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load draws data.' } },
      { status: 500 },
    );
  }
}
