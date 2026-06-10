import { TopNav } from '@/components/layout/TopNav';

interface SwissPageShellProps {
  children: React.ReactNode;
}

/** Shared shell for all System B (Swiss Particle Brutalism) content pages.
 *  Renders the dot-grid texture, grain overlay, TopNav, and a scrollable main area.
 */
export function SwissPageShell({ children }: SwissPageShellProps) {
  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: 'var(--pw-bg)' }}
    >
      <div className="pw-dot-grid" aria-hidden="true" />
      <div className="pw-grain" aria-hidden="true" />
      <TopNav />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
