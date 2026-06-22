import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getApplicationData } from '@/modules/application/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ApplicationPageClient } from '@/components/dashboard/ApplicationPageClient';
import type { DashboardDocument, ProfileContext } from '@/modules/dashboard/types';

/** Builds initials (up to 2 chars) from a full name. */
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

/** Server component: fetches application data and renders the owned application page. */
export default async function DashboardApplicationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `dashboard-application-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'dashboardApplicationPage.start', userId: user.id });

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
  const profile = profileRow as ProfileFields | null;
  const fullName = profile?.full_name ?? null;
  const firstName = deriveFirstName(fullName);
  const avatarInitials = deriveInitials(fullName);

  const profileContext: ProfileContext = {
    fullName,
    occupation: profile?.occupation ?? null,
    degreeLevel: profile?.degree_level ?? null,
    degreeField: profile?.degree_field ?? null,
    nationality: profile?.nationality ?? null,
  };

  let appData;
  try {
    appData = await getApplicationData(user.id, logger);
  } catch (err) {
    logger.error({ action: 'dashboardApplicationPage.error', userId: user.id, err });
    return (
      <DashboardShell avatarInitials={avatarInitials} firstName={firstName}>
        <div className="flex flex-1 items-center justify-center" style={{ padding: 28 }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E5E5E5',
            borderRadius: 12,
            padding: '32px 28px',
            maxWidth: 400,
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: 'var(--pw-font-display)', fontSize: '1.5rem',
              color: '#0D0D0D', marginBottom: 8, lineHeight: 1.2,
            }}>
              Something went wrong
            </p>
            <p style={{
              fontFamily: 'var(--pw-font-body)', fontSize: 14,
              color: '#6B6B6B', marginBottom: 20,
            }}>
              We couldn&apos;t load your application. Please try again.
            </p>
            <a
              href="/dashboard/application"
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '9px 20px', fontFamily: 'var(--pw-font-body)',
                fontSize: 14, fontWeight: 500, color: '#FFFFFF',
                background: '#0D0D0D', borderRadius: 9999, textDecoration: 'none',
              }}
            >
              Retry
            </a>
          </div>
        </div>
      </DashboardShell>
    );
  }

  logger.info({ action: 'dashboardApplicationPage.complete', userId: user.id, hasData: !!appData });

  if (!appData) {
    return (
      <DashboardShell avatarInitials={avatarInitials} firstName={firstName}>
        <div className="flex flex-1 items-center justify-center" style={{ padding: 28 }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <p style={{
              fontFamily: 'var(--pw-font-display)', fontSize: '1.5rem',
              color: '#0D0D0D', marginBottom: 10, lineHeight: 1.2,
            }}>
              No pathway selected yet.
            </p>
            <p style={{
              fontFamily: 'var(--pw-font-body)', fontSize: 14,
              color: '#6B6B6B', marginBottom: 24, lineHeight: 1.6,
            }}>
              Select a pathway to see your personalized roadmap.
            </p>
            <Link
              href="/onboarding/matches"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', fontFamily: 'var(--pw-font-body)',
                fontSize: 14, fontWeight: 500, color: '#FFFFFF',
                background: '#0D0D0D', borderRadius: 9999, textDecoration: 'none',
              }}
            >
              Browse pathways →
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const drawerDocuments: DashboardDocument[] = appData.documents.map((d) => ({
    id: d.id,
    name: d.name,
    isMandatory: d.isMandatory,
    status: 'pending',
  }));

  return (
    <DashboardShell avatarInitials={avatarInitials} firstName={firstName}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ApplicationPageClient
          pathway={{
            title: appData.pathwayTitle,
            officialName: appData.pathwayOfficialName ?? '',
            slug: appData.pathwaySlug,
            processingTime: appData.processingTime,
            totalSteps: appData.totalSteps,
            description: appData.pathwayDescription ?? '',
          }}
          steps={appData.steps}
          profileContext={profileContext}
          documents={drawerDocuments}
        />
      </div>
    </DashboardShell>
  );
}
