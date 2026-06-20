import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth } from '@/modules/auth/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateCoverLetter, type CoverLetterInput } from '@/lib/cover-letter-generator';
import { PathwaysError } from '@/lib/errors';

const bodySchema = z.object({
  stepId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
});

/** POST /api/cover-letter/generate — generate a cover letter draft for a specific step. */
export async function POST(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.cover_letter.generate.start' });

  try {
    const user = await requireAuth();
    const db = await createSupabaseServerClient() as unknown as SupabaseClient;

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'stepId (UUID) is required.' } },
        { status: 400 }
      );
    }

    const { stepId } = parsed.data;

    // Fetch profile
    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profileData) {
      log.error({ action: 'api.cover_letter.generate.profile_not_found', userId: user.id });
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Profile not found.' } },
        { status: 404 }
      );
    }

    const profile = profileData as Record<string, unknown>;

    // Fetch step + pathway
    const { data: stepData, error: stepError } = await db
      .from('pathway_steps')
      .select('id, title, step_number, pathway_id')
      .eq('id', stepId)
      .single();

    if (stepError || !stepData) {
      log.error({ action: 'api.cover_letter.generate.step_not_found', stepId });
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Step not found.' } },
        { status: 404 }
      );
    }

    const step = stepData as { id: string; title: string; step_number: number; pathway_id: string };

    const { data: pathwayData, error: pathwayError } = await db
      .from('pathways')
      .select('title')
      .eq('id', step.pathway_id)
      .single();

    if (pathwayError || !pathwayData) {
      log.error({ action: 'api.cover_letter.generate.pathway_not_found', pathwayId: step.pathway_id });
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Pathway not found.' } },
        { status: 404 }
      );
    }

    const pathway = pathwayData as { title: string };

    const input: CoverLetterInput = {
      fullName: (profile.full_name as string | null) ?? 'Applicant',
      nationality: (profile.nationality as string | null) ?? 'Unknown',
      occupation: (profile.occupation as string | null) ?? 'Professional',
      yearsExperience: (profile.years_experience as number | null) ?? 0,
      educationLevel: (profile.education_level as string | null) ?? (profile.degree_level as string | null) ?? 'Not specified',
      degreeField: (profile.degree_field as string | null) ?? 'Not specified',
      destinationCountry: (profile.destination_country as string | null) ?? 'Canada',
      pathwayName: pathway.title,
      stepTitle: step.title,
      nocCode: (profile.noc_code as string | null | undefined) ?? undefined,
      clbSpeaking: (profile.clb_speaking as number | null | undefined) ?? undefined,
      clbListening: (profile.clb_listening as number | null | undefined) ?? undefined,
      clbReading: (profile.clb_reading as number | null | undefined) ?? undefined,
      clbWriting: (profile.clb_writing as number | null | undefined) ?? undefined,
      hasCanadianJobOffer: (profile.has_canadian_job_offer as boolean | null | undefined) ?? undefined,
      intendedProvince: (profile.intended_province as string | null | undefined) ?? undefined,
    };

    const letter = await generateCoverLetter(input);

    log.info({ action: 'api.cover_letter.generate.complete', userId: user.id });
    return Response.json({ letter }, { status: 200 });
  } catch (err) {
    if (err instanceof PathwaysError) {
      log.error({ action: 'api.cover_letter.generate.error', code: err.code, message: err.message });
      return Response.json(
        { error: { code: err.code, message: err.message } },
        { status: err.statusCode }
      );
    }
    log.error({ action: 'api.cover_letter.generate.error', error: String(err) });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
      { status: 500 }
    );
  }
}
