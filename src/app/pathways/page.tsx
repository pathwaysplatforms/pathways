import { redirect } from 'next/navigation';

/** Redirects /pathways to the dashboard pathways plane view. */
export default function PathwaysPage() {
  redirect('/dashboard/pathways');
}
