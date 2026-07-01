import { redirect } from 'next/navigation';

/** Redirects legacy /pathways/results to the dashboard pathways plane view. */
export default function PathwayResultsPage() {
  redirect('/dashboard/pathways');
}
