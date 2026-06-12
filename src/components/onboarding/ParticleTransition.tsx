'use client';

import { useEffect, useRef } from 'react';

interface ParticleTransitionProps {
  /** Called after the full animation completes (~1900ms). Caller should push router. */
  onDone: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alpha: number;
  phase: 'converge' | 'hold' | 'scatter';
}

const PARTICLE_COUNT = 1200;
const CONVERGE_END = 900;
const HOLD_END = 1100;
const SCATTER_END = 1900;

/** Full-screen canvas particle swarm transition. Mounts over a white overlay,
 *  particles converge to center, pulse, then scatter as the overlay fades. */
export function ParticleTransition({ onDone }: ParticleTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const cx = W / 2;
    const cy = H / 2;

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0,
      vy: 0,
      angle: (i / PARTICLE_COUNT) * Math.PI * 2,
      alpha: 0.15,
      phase: 'converge' as const,
    }));

    let peakDotDrawn = false;

    function draw(ts: number) {
      if (!ctx || !canvas) return;
      if (startRef.current === 0) startRef.current = ts;
      const elapsed = ts - startRef.current;

      ctx.clearRect(0, 0, W, H);

      const particles = particlesRef.current;

      if (elapsed < CONVERGE_END) {
        // Phase 1: converge
        for (const p of particles) {
          p.vx += (cx - p.x) * 0.06;
          p.vy += (cy - p.y) * 0.06;
          p.vx *= 0.82;
          p.vy *= 0.82;
          p.x += p.vx;
          p.y += p.vy;

          const dist = Math.hypot(p.x - cx, p.y - cy);
          const maxDist = Math.hypot(W, H) / 2;
          p.alpha = 0.15 + (1 - Math.min(dist / maxDist, 1)) * 0.75;

          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(26,26,26,${p.alpha.toFixed(3)})`;
          ctx.fill();
        }
      } else if (elapsed < HOLD_END) {
        // Phase 2: hold / orbit
        const holdProgress = (elapsed - CONVERGE_END) / (HOLD_END - CONVERGE_END);
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]!;
          p.angle += 0.04 + (i % 7) * 0.002;
          const r = 2 + Math.sin(elapsed * 0.003 + i) * 3;
          p.x = cx + Math.cos(p.angle) * r;
          p.y = cy + Math.sin(p.angle) * r;
          p.alpha = 0.9;

          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(26,26,26,${p.alpha.toFixed(3)})`;
          ctx.fill();
        }

        // Accent dot at peak
        if (holdProgress > 0.5 && !peakDotDrawn) {
          peakDotDrawn = true;
        }
        if (peakDotDrawn) {
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#1A56DB';
          ctx.fill();
        }
      } else if (elapsed < SCATTER_END) {
        // Phase 3: scatter
        const scatterProgress = (elapsed - HOLD_END) / (SCATTER_END - HOLD_END);

        for (const p of particles) {
          if (p.phase !== 'scatter') {
            p.phase = 'scatter';
            const angle = Math.atan2(p.y - cy, p.x - cx);
            const speed = 4 + Math.random() * 8;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.alpha = 0.9 * (1 - scatterProgress);

          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(26,26,26,${Math.max(0, p.alpha).toFixed(3)})`;
          ctx.fill();
        }

        // Fade canvas + overlay in last 400ms
        if (elapsed > SCATTER_END - 400) {
          const fadeProgress = (elapsed - (SCATTER_END - 400)) / 400;
          canvas.style.opacity = String(Math.max(0, 1 - fadeProgress));
          if (overlayRef.current) {
            overlayRef.current.style.opacity = String(Math.max(0, 1 - fadeProgress));
          }
        }
      } else {
        canvas.style.opacity = '0';
        if (overlayRef.current) overlayRef.current.style.opacity = '0';
        cancelAnimationFrame(rafRef.current);
        onDone();
        return;
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [onDone]);

  return (
    <>
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'white',
          zIndex: 9998,
          pointerEvents: 'none',
          transition: 'opacity 0ms',
        }}
        aria-hidden="true"
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    </>
  );
}
