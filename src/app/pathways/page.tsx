import { redirect } from 'next/navigation';

/** Redirects /pathways to the pathway results page. */
export default function PathwaysPage() {
  redirect('/pathways/results');
}
