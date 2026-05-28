import { notFound, redirect } from 'next/navigation';
import { getProfile } from '@/modules/auth/service';
import { getApplicationData } from '@/modules/pathways/service';
import { mockApplication } from '@/modules/pathways/mock-application';
import { ApplicationLayout } from '@/components/application/ApplicationLayout';
import { createRequestLogger } from '@/lib/logger';
import { NotFoundError } from '@/lib/errors';

interface Props {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ mock?: string }>;
}

/** Serves real application data from the DB, or mock data when ?mock=true. */
export default async function ApplicationPage({ params, searchParams }: Props) {
  const { applicationId } = await params;
  const { mock } = await searchParams;

  if (mock === 'true') {
    return <ApplicationLayout application={mockApplication} />;
  }

  const profile = await getProfile();
  if (!profile) {
    redirect('/auth/login');
  }

  const correlationId = `app-${applicationId}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);

  try {
    const application = await getApplicationData(applicationId, logger);
    return <ApplicationLayout application={application} />;
  } catch (err) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }
}
