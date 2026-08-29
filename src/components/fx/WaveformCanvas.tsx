'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface WaveformCanvasProps {
  /** Live analyser to drive bar heights from real input level; falls back to a calm idle wave when null. */
  analyser: AnalyserNode | null;
  /** Whether the waveform is active (listening/speaking). Inactive renders flat low bars. */
  active: boolean;
  /** Bar colour. Default electric blue. */
  color?: string;
  /** Number of bars. Default 5. */
  barCount?: number;
  /** Canvas width in px. Default 40. */
  width?: number;
  /** Canvas height in px. Default 28. */
  height?: number;
}

/**
 * Minimal bar waveform on a 2D canvas. Driven by real audio frequency data
 * when an analyser is provided, otherwise a slow idle undulation. Under
 * reduced motion it renders static mid-height bars while active.
 */
export function WaveformCanvas({
  analyser,
  active,
  color = '#1A56DB',
  barCount = 5,
  width = 40,
  height = 28,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const barW = 3;
    const gap = (width - barCount * barW) / (barCount - 1);
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    function levels(ts: number): number[] {
      if (!active) return Array.from({ length: barCount }, () => 0.12);
      if (reduced) return Array.from({ length: barCount }, () => 0.45);
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const binsPerBar = Math.floor(freqData.length / barCount);
        return Array.from({ length: barCount }, (_, i) => {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) sum += freqData[i * binsPerBar + j] ?? 0;
          return Math.max(0.12, Math.min(1, sum / binsPerBar / 200));
        });
      }
      return Array.from(
        { length: barCount },
        (_, i) => 0.3 + 0.25 * Math.sin(ts / 600 + i * 0.9)
      );
    }

    let rafId = 0;
    const draw = (ts: number) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.globalAlpha = active ? 0.8 : 0.25;
      const lv = levels(ts);
      for (let i = 0; i < barCount; i++) {
        const h = Math.max(3, (lv[i] ?? 0.12) * height);
        const x = i * (barW + gap);
        ctx.beginPath();
        ctx.roundRect(x, height - h, barW, h, 1.5);
        ctx.fill();
      }
      if (!reduced) rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    const onVisibility = () => {
      cancelAnimationFrame(rafId);
      if (!document.hidden) rafId = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [analyser, active, color, barCount, width, height, reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: 'block', width, height }}
    />
  );
}
