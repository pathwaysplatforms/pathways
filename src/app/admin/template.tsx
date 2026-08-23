import { PageTransition } from '@/components/fx/PageTransition';

/** Route-enter transition, scoped below the admin layout so the admin sidebar persists. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
