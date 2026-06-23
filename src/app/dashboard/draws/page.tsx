import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getProfile } from '@/modules/auth/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DrawsClient } from '@/components/draws/DrawsClient';
import type { Draw } from '@/components/draws/DrawsClient';

/** Derives avatar initials (up to 2 chars) from a full name. */
function deriveInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/** Extracts the first name from a full name string. */
function deriveFirstName(fullName: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] ?? 'there';
}

/** Express Entry draws history page — reference data, no auth required on the fetch itself. */
export default async function DrawsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/auth/login');

  const correlationId = `draws-${profile.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'draws.start', profileId: profile.id });

  const supabase = await createSupabaseServerClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: rawDraws, error } = await db
    .from('immigration_draws')
    .select('id, draw_date, draw_type, cutoff_score, invitations_issued, round_number, program')
    .eq('country', 'canada')
    .order('draw_date', { ascending: true });

  if (error) {
    logger.error({ action: 'draws.fetchError', error });
    return (
      <DashboardShell
        avatarInitials={deriveInitials(profile.full_name)}
        firstName={deriveFirstName(profile.full_name)}
      >
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-7">
          <div
            className="pw-entry is-visible"
            style={{
              maxWidth: 400,
              textAlign: 'center',
              padding: '32px 28px',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--pw-font-display)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#0D0D0D',
                marginBottom: 8,
              }}
            >
              Failed to load draws
            </p>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                color: '#6B6B6B',
                marginBottom: 20,
              }}
            >
              {error.message ?? 'An unexpected error occurred. Please try again.'}
            </p>
            <a
              href="/dashboard/draws"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 20px',
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                background: '#0D0D0D',
                borderRadius: 9999,
                textDecoration: 'none',
              }}
            >
              Retry
            </a>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Normalise: strip rows with null fields required by Draw interface
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
    .map((d) => ({
      id: d.id,
      draw_date: d.draw_date,
      draw_type: d.draw_type,
      cutoff_score: d.cutoff_score,
      invitations_issued: d.invitations_issued,
      round_number: d.round_number,
      program: d.program,
    }));

  logger.info({ action: 'draws.complete', count: draws.length });

  return (
    <DashboardShell
      avatarInitials={deriveInitials(profile.full_name)}
      firstName={deriveFirstName(profile.full_name)}
    >
      <DrawsClient draws={draws} />
    </DashboardShell>
  );
}
