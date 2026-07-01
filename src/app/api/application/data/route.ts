import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getApplicationData } from '@/modules/application/service';
import type { ProfileContext, DashboardDocument } from '@/modules/dashboard/types';

/** GET /api/application/data — application data for the NavigationPlane ApplicationView. */
export async function GET(): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.application.data.start' });

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
    const { data: profileRow } = await db
      .from('profiles')
      .select('full_name, occupation, degree_level, degree_field, nationality')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    type ProfileFields = {
      full_name: string | null;
      occupation: string | null;
      degree_level: string | null;
      degree_field: string | null;
      nationality: string | null;
    };
    const pf = profileRow as ProfileFields | null;
    const profileContext: ProfileContext = {
      fullName: pf?.full_name ?? null,
      occupation: pf?.occupation ?? null,
      degreeLevel: pf?.degree_level ?? null,
      degreeField: pf?.degree_field ?? null,
      nationality: pf?.nationality ?? null,
    };

    const appData = await getApplicationData(user.id, log);

    if (!appData) {
      log.info({ action: 'api.application.data.noApp' });
      return Response.json({ data: null, profileContext });
    }

    const documents: DashboardDocument[] = appData.documents.map(d => ({
      id: d.id,
      name: d.name,
      isMandatory: d.isMandatory,
      status: 'pending',
    }));

    log.info({ action: 'api.application.data.complete' });
    return Response.json({
      data: {
        pathway: {
          title: appData.pathwayTitle,
          officialName: appData.pathwayOfficialName ?? '',
          slug: appData.pathwaySlug,
          processingTime: appData.processingTime,
          totalSteps: appData.totalSteps,
          description: appData.pathwayDescription ?? '',
        },
        steps: appData.steps,
        profileContext,
        documents,
      },
    });
  } catch (err) {
    log.error({ action: 'api.application.data.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load application data.' } },
      { status: 500 },
    );
  }
}
