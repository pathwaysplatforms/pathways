'use client';

import { useEffect, useRef } from 'react';

interface CrsDotsCanvasProps {
  scoreLow: number;
  scoreHigh: number;
  cutoff?: number;
  maxScore?: number;
}

/** Canvas dot density visualizer encoding CRS score position within the Express Entry pool. */
export function CrsDotsCanvas({
  scoreLow,
  scoreHigh,
  cutoff = 480,
  maxScore = 1200,
}: CrsDotsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const COLS = 80;
    const ROWS = 8;
    const ANIM_DURATION = 800;

    function render(ts: number) {
      if (!ctx || !canvas) return;
      if (startRef.current === 0) startRef.current = ts;
      const elapsed = ts - startRef.current;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const lowPct = scoreLow / maxScore;
      const highPct = scoreHigh / maxScore;
      const cutoffPct = cutoff / maxScore;

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const colPct = col / COLS;
          const colDelay = col * 6;
          const colProgress = Math.min(1, Math.max(0, (elapsed - colDelay) / (ANIM_DURATION - colDelay)));
          if (colProgress <= 0) continue;

          const baseX = (col / COLS) * W + W / COLS / 2;
          const baseY = (row / ROWS) * H + H / ROWS / 2;

          let alpha: number;
          let radius: number;
          let jitterX = 0;
          let jitterY = 0;

          if (colPct >= lowPct && colPct <= highPct) {
            // Score zone — bright and jittered
            alpha = (0.5 + Math.random() * 0.4) * colProgress;
            radius = 2.2;
            jitterX = (Math.random() - 0.5) * 4;
            jitterY = (Math.random() - 0.5) * 4;
          } else if (colPct >= cutoffPct) {
            // Above cutoff — very faint
            alpha = 0.06 * colProgress;
            radius = 1;
          } else if (colPct > highPct && colPct < cutoffPct) {
            // Between score and cutoff — medium
            alpha = 0.28 * colProgress;
            radius = 1.5;
          } else {
            // Below score — faint ordered pattern
            alpha = (0.12 + Math.sin(col * 0.3 + row * 0.7) * 0.05) * colProgress;
            radius = 1.5;
          }

          ctx.beginPath();
          ctx.arc(baseX + jitterX, baseY + jitterY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      // Cut-off marker
      const cutoffX = cutoffPct * W;
      ctx.beginPath();
      ctx.moveTo(cutoffX, 0);
      ctx.lineTo(cutoffX, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '10px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(`Cut-off ~${cutoff}`, cutoffX, 12);

      // Score marker
      const scoreX = lowPct * W;
      ctx.beginPath();
      ctx.moveTo(scoreX, 0);
      ctx.lineTo(scoreX, H);
      ctx.strokeStyle = '#1A56DB';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(scoreX, 6, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#1A56DB';
      ctx.fill();

      ctx.font = '10px "DM Sans", system-ui, sans-serif';
      ctx.fillStyle = '#1A56DB';
      ctx.textAlign = 'center';
      ctx.fillText('Your score', scoreX, H - 4);

      if (elapsed < ANIM_DURATION + COLS * 6) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    }

    function setup() {
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = 120;
      startRef.current = 0;
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(render);
    }

    setup();

    const ro = new ResizeObserver(() => setup());
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [scoreLow, scoreHigh, cutoff, maxScore]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '120px' }}
      aria-label={`CRS score range ${scoreLow}–${scoreHigh} visualized as dot density`}
    />
  );
}
