'use client';

import { useReducedMotion } from '@/hooks/useReducedMotion';

interface CheckmarkDrawProps {
  /** Square size in px. Default 16. */
  size?: number;
  /** Stroke colour. Default ink black. */
  color?: string;
  /** Stroke width. Default 2. */
  strokeWidth?: number;
  /** When false the check renders fully drawn with no animation. Default true. */
  animate?: boolean;
}

const PATH_LENGTH = 14.5;

/** Ink checkmark that draws itself in via stroke-dashoffset (~400ms); static under reduced motion. */
export function CheckmarkDraw({
  size = 16,
  color = '#0D0D0D',
  strokeWidth = 2,
  animate = true,
}: CheckmarkDrawProps) {
  const reduced = useReducedMotion();
  const drawn = !animate || reduced;

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 8.5L6 12L13.5 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          drawn
            ? undefined
            : {
                strokeDasharray: PATH_LENGTH,
                strokeDashoffset: PATH_LENGTH,
                animation: 'pw-check-draw 400ms var(--pw-ease-calm) forwards',
              }
        }
      />
    </svg>
  );
}
