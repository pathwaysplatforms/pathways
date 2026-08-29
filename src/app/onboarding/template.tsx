import { PageTransition } from '@/components/fx/PageTransition';

/** Route-enter transition, scoped to this segment so parent layouts persist across navigations. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
