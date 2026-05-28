import { mockApplication } from '@/modules/pathways/mock-application';
import { ApplicationLayout } from '@/components/application/ApplicationLayout';

interface Props {
  params: { applicationId: string };
  searchParams: { mock?: string };
}

/**
 * Route entry point: always serves mock data until the real DB fetch is wired in.
 * TODO: replace mockApplication with a real fetch using params.applicationId once
 * the backend application matcher is ready.
 */
export default function ApplicationPage({ params: _params, searchParams: _searchParams }: Props) {
  return <ApplicationLayout application={mockApplication} />;
}
