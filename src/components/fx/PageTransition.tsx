'use client';

import { useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Route-enter transition: brief fade + 10px rise using the calm easing.
 * The animation class is dropped on completion so the wrapper never keeps a
 * transform (which would turn it into a containing block for fixed-position
 * drawers and modals rendered inside the page).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const [settled, setSettled] = useState(false);

  return (
    <div
      className={settled ? undefined : 'pw-page-enter'}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setSettled(true);
      }}
    >
      {children}
    </div>
  );
}
