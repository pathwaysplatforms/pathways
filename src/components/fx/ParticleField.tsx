'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface ParticleFieldProps {
  /** Particles per 10,000 px² of canvas area. Default 0.6 (sparse). */
  density?: number;
  /** Overall opacity of the field, 0–1. Default 0.05. */
  opacity?: number;
  /** Particle colour. Default var(--pw-particle-accent) electric blue. */
  color?: string;
  /** Max parallax offset in px in response to mouse movement. Default 10, 0 disables. */
  parallax?: number;
  /** Positioning override; defaults to filling the nearest positioned ancestor. */
  className?: string;
  style?: React.CSSProperties;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  depth: number;
}

const DEFAULT_COLOR = '#1A56DB';

/** Drifting dot-field canvas texture with gentle mouse parallax. Pure 2D canvas, pauses when the tab is hidden. */
export function ParticleField({
  density = 0.6,
  opacity = 0.05,
  color = DEFAULT_COLOR,
  parallax = 10,
  className,
  style,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let rafId = 0;
    let running = false;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const mouse = { x: 0, y: 0 };
    const offset = { x: 0, y: 0 };

    function seed() {
      const count = Math.round((width * height) / 10000 * density);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.8 + Math.random() * 1.2,
        depth: 0.3 + Math.random() * 0.7,
      }));
    }

    function draw(step: boolean) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (const p of particles) {
        if (step) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -2) p.x = width + 2;
          if (p.x > width + 2) p.x = -2;
          if (p.y < -2) p.y = height + 2;
          if (p.y > height + 2) p.y = -2;
        }
        ctx.beginPath();
        ctx.arc(p.x + offset.x * p.depth, p.y + offset.y * p.depth, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick() {
      // Lerp toward the mouse-derived parallax target — keeps motion calm.
      offset.x += (mouse.x * parallax - offset.x) * 0.04;
      offset.y += (mouse.y * parallax - offset.y) * 0.04;
      draw(true);
      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (running || reduced) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw(false);
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    ro.observe(canvas);

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();
    if (!reduced) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      start();
    }

    return () => {
      stop();
      ro.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density, color, parallax, reduced]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        ...style,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
