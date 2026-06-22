import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getProfileTabData } from '@/modules/profile/service';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProfileClient } from './ProfileClient';

/** Profile tab — displays and allows editing of the user's immigration profile. */
export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `profile-tab-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'profileTab.start', userId: user.id });

  let data;
  try {
    data = await getProfileTabData(user.id, logger);
  } catch (err) {
    logger.error({ action: 'profileTab.error', userId: user.id, err });
    return (
      <DashboardShell avatarInitials="?" firstName="">
        <div className="flex flex-1 items-center justify-center p-7">
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
                fontSize: '1.5rem',
                color: '#0D0D0D',
                marginBottom: 8,
              }}
            >
              Something went wrong
            </p>
            <p
              style={{
                fontFamily: 'var(--pw-font-body)',
                fontSize: 14,
                color: '#6B6B6B',
                marginBottom: 20,
              }}
            >
              We couldn&apos;t load your profile. Please try again.
            </p>
            <a
              href="/dashboard/profile"
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

  logger.info({ action: 'profileTab.complete', userId: user.id });

  return (
    <DashboardShell
      avatarInitials={data.avatarInitials}
      firstName={data.firstName}
      applicationId={data.applicationId}
    >
      <ProfileClient data={data} />
    </DashboardShell>
  );
}
