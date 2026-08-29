'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in ms before the rise starts once in view. Default 0. */
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** IntersectionObserver-driven fade + 12px rise for section reveals; instant under reduced motion. */
export function Reveal({ children, delayMs = 0, className, style }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const shown = visible || reduced;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(12px)',
        transition: reduced
          ? 'none'
          : `opacity 400ms var(--pw-ease-calm) ${delayMs}ms, transform 400ms var(--pw-ease-calm) ${delayMs}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
