'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ParticleBurstProps {
  /** Number of particles. Default 12. */
  count?: number;
  /** Particle colour. Default electric blue. */
  color?: string;
  /** Canvas square size in px. Default 72. */
  size?: number;
}

/**
 * One-shot "settle" burst: a handful of particles rise briefly, drift down and
 * fade over ~600ms. Plays once on mount — render it conditionally to trigger.
 * Renders nothing under reduced motion.
 */
export function ParticleBurst({ count = 12, color = '#1A56DB', size = 72 }: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const particles = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.2;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        r: 1 + Math.random() * 1.4,
      };
    });

    const DURATION = 600;
    let rafId = 0;
    let startTs = 0;

    const tick = (ts: number) => {
      if (startTs === 0) startTs = ts;
      const t = Math.min(1, (ts - startTs) / DURATION);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = color;
      ctx.globalAlpha = 1 - t;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t < 1) rafId = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, size, size);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [count, color, size, reduced]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    />
  );
}
