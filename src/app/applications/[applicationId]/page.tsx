import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getProfile } from '@/modules/auth/service';
import { getApplicationForLayout } from '@/modules/application/service';
import { ApplicationLayout } from '@/components/application/ApplicationLayout';

interface Props {
  params: Promise<{ applicationId: string }>;
}

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

/** Application overview + step tracker for a single application, scoped to the owner. */
export default async function ApplicationPage({ params }: Props) {
  const { applicationId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `application-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'applicationPage.start', userId: user.id, applicationId });

  const [application, profile] = await Promise.all([
    getApplicationForLayout(applicationId, user.id, logger),
    getProfile(),
  ]);

  if (!application) {
    logger.info({ action: 'applicationPage.notFound', userId: user.id, applicationId });
    notFound();
  }

  logger.info({ action: 'applicationPage.complete', userId: user.id, applicationId });

  const fullName = profile?.full_name ?? null;

  return (
    <ApplicationLayout
      application={application}
      avatarInitials={deriveInitials(fullName)}
      firstName={deriveFirstName(fullName)}
    />
  );
}
