import { PageTransition } from '@/components/fx/PageTransition';

/** Root template: remounts on every route change, giving each page a calm enter transition. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
