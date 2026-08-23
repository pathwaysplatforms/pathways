'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TopNav } from './TopNav';
import { NavigationPlane, PLANE_PATHS, pathToIndex } from './NavigationPlane';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { BackgroundLayer } from './BackgroundLayer';
import { useShouldReduceMotion } from '@/hooks/useReducedMotion';
import { flushAllChecklists } from '@/lib/checklist-flush-registry';
import type { SubscriptionStatus } from '@/modules/account/types';

interface DashboardShellProps {
  children: React.ReactNode;
  avatarInitials: string;
  firstName: string;
  subscriptionStatus?: SubscriptionStatus;
}

const PLANE_PATH_SET = new Set<string>(PLANE_PATHS);

/** Full-viewport shell: top nav + sliding plane (or pass-through children for non-plane routes). */
export function DashboardShell({
  children,
  avatarInitials,
  firstName,
  subscriptionStatus = 'free',
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isPlane = PLANE_PATH_SET.has(pathname);
  const shouldReduceMotion = useShouldReduceMotion();

  const [activeIndex, setActiveIndex] = useState(() => pathToIndex(pathname));
  const [modalOpen, setModalOpen] = useState(false);

  const handleNavigate = useCallback((targetIndex: number) => {
    // NavigationPlane only exists while on a plane route — from a non-plane page
    // (e.g. /dashboard/ask) there's nothing mounted to react to activeIndex, so a
    // real route change is required instead of just flipping local state.
    if (!isPlane) {
      router.push(PLANE_PATHS[targetIndex]);
      return;
    }
    setActiveIndex((prev) => {
      // Flush checklist debounces when leaving the Application view (index 1).
      if (prev === 1 && targetIndex !== 1) {
        flushAllChecklists();
      }
      return targetIndex;
    });
  }, [isPlane, router]);

  // Re-sync activeIndex whenever a route change lands back on a plane path from
  // outside it (router.push above, a Link, or browser back/forward) — the state
  // set on mount can otherwise go stale while a non-plane page was showing.
  useEffect(() => {
    if (isPlane) {
      setActiveIndex(pathToIndex(pathname));
    }
  }, [pathname, isPlane]);

  const handlePopState = useCallback((index: number) => {
    setActiveIndex((prev) => {
      if (prev === 1 && index !== 1) {
        flushAllChecklists();
      }
      return index;
    });
  }, []);

  const handleOpenModal = useCallback(() => setModalOpen(true), []);
  const handleCloseModal = useCallback(() => setModalOpen(false), []);

  const showBackground = !isPlane || (activeIndex !== 1 && activeIndex !== 2);

  return (
    <div
      className={`h-screen overflow-hidden flex flex-col${shouldReduceMotion ? ' pw-reduce-motion' : ''}`}
      style={{ background: '#FFFFFF' }}
    >
      {showBackground && <BackgroundLayer />}
      <TopNav
        avatarInitials={avatarInitials}
        firstName={firstName}
        subscriptionStatus={subscriptionStatus}
        activeIndex={isPlane ? activeIndex : -1}
        onNavigate={handleNavigate}
        onOpenModal={handleOpenModal}
      />
      <main className="flex-1 overflow-hidden flex flex-col relative">
        {isPlane ? (
          <NavigationPlane
            activeIndex={activeIndex}
            onPopState={handlePopState}
          />
        ) : (
          children
        )}
      </main>

      <ProfileSettingsModal isOpen={modalOpen} onClose={handleCloseModal} />
    </div>
  );
}
