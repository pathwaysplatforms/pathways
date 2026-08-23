import { PageTransition } from '@/components/fx/PageTransition';

/**
 * Dashboard-scoped template: only page content fades in on navigation, while the
 * persistent shell (top nav, sliding plane, WebGL background) stays mounted.
 * The flex classes keep the wrapper stretching inside the shell's flex column.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
