'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AnimatedNumberProps {
  /** Target value to count up to. */
  value: number;
  /** Tween duration in ms. Default 700. */
  durationMs?: number;
  /** Rendered before the number, e.g. "$". */
  prefix?: string;
  /** Rendered after the number, e.g. "+", " min". */
  suffix?: string;
  /** Custom formatter for the in-flight value. Defaults to rounded integer. */
  format?: (n: number) => string;
  /** When true (default), the count-up starts when the element scrolls into view. */
  startInView?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/* Close approximation of cubic-bezier(0.16, 1, 0.3, 1) — strong ease-out, no overshoot. */
function easeCalm(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Counts a number up via requestAnimationFrame; renders the final value instantly under reduced motion. */
export function AnimatedNumber({
  value,
  durationMs = 700,
  prefix = '',
  suffix = '',
  format,
  startInView = true,
  className,
  style,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(!startInView);
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (started || !spanRef.current) return;
    const el = spanRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    fromRef.current = value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    let rafId = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (startTs === 0) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      setDisplay(from + (value - from) * easeCalm(t));
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [started, value, durationMs, reduced]);

  const text = format ? format(display) : String(Math.round(display));

  return (
    <span ref={spanRef} className={className} style={style}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
