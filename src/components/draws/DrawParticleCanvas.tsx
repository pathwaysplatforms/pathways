'use client';

import { useEffect, useRef } from 'react';

interface Draw {
  date: string;
  type: string;
  invitations: number;
  cutoff: number;
}

interface DrawParticleCanvasProps {
  draws: Draw[];
  userScore: number | null;
}

const SCORE_MIN = 300;
const SCORE_MAX = 600;
const CANVAS_HEIGHT = 360;
const SPREAD_X = 32;
const SPREAD_Y = 28;

function mapScoreToY(score: number, h: number): number {
  return h - ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * h;
}

function gaussian(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

/** Canvas particle scatter visualization for Express Entry draw history.
 *  Each draw is a gaussian cloud of dots; user score is a horizontal accent line. */
export function DrawParticleCanvas({ draws, userScore }: DrawParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interface RenderedParticle {
      x: number;
      y: number;
      r: number;
      baseAlpha: number;
      qualifies: boolean;
      drawIndex: number;
      delay: number;
    }

    let particles: RenderedParticle[] = [];
    let startTs = 0;

    function buildParticles(W: number, H: number) {
      particles = [];
      const slotW = W / (draws.length + 1);

      draws.forEach((draw, di) => {
        const cloudX = slotW * (di + 1);
        const cloudY = mapScoreToY(draw.cutoff, H);
        const count = Math.round(draw.invitations / 4);
        const qualifies = userScore !== null && draw.cutoff <= userScore;

        for (let i = 0; i < count; i++) {
          const dx = gaussian() * SPREAD_X;
          const dy = gaussian() * SPREAD_Y;
          const px = cloudX + dx;
          const py = cloudY + dy;
          const dist = Math.hypot(dx, dy);
          const maxDist = Math.hypot(SPREAD_X, SPREAD_Y);
          const baseAlpha = 0.15 + (1 - Math.min(dist / maxDist, 1)) * 0.65;

          particles.push({
            x: px,
            y: py,
            r: 1 + Math.random() * 1.2,
            baseAlpha,
            qualifies,
            drawIndex: di,
            delay: di * 200 + Math.random() * 400,
          });
        }
      });
    }

    function drawFrame(ts: number) {
      if (!ctx || !canvas) return;
      if (startTs === 0) startTs = ts;
      const elapsed = ts - startTs;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Axis labels
      ctx.font = '10px "Urbanist", sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.textAlign = 'right';
      [350, 400, 450, 500, 550].forEach((score) => {
        const y = mapScoreToY(score, H);
        ctx.fillText(String(score), 36, y + 3);
      });

      // User score line
      if (userScore !== null) {
        const lineY = mapScoreToY(userScore, H);
        ctx.beginPath();
        ctx.moveTo(40, lineY);
        ctx.lineTo(W, lineY);
        ctx.strokeStyle = '#1A56DB';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.font = '11px "Urbanist", sans-serif';
        ctx.fillStyle = '#1A56DB';
        ctx.textAlign = 'left';
        ctx.fillText(`Your score ~${userScore}`, 44, lineY - 4);

        ctx.beginPath();
        ctx.arc(W - 6, lineY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#1A56DB';
        ctx.fill();
      }

      // Particles
      for (const p of particles) {
        const fadeProgress = Math.min(1, Math.max(0, (elapsed - p.delay) / 400));
        if (fadeProgress <= 0) continue;

        const alpha = p.qualifies
          ? p.baseAlpha * fadeProgress
          : p.baseAlpha * 0.22 * fadeProgress;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26,26,26,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // Draw date labels below each cloud
      const slotW = W / (draws.length + 1);
      ctx.font = '10px "Urbanist", sans-serif';
      ctx.textAlign = 'center';
      draws.forEach((draw, di) => {
        const cloudX = slotW * (di + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        const parts = draw.date.split('-');
        const label = parts.length >= 2 ? `${parts[1]}/${parts[2] ?? ''}` : draw.date;
        ctx.fillText(label, cloudX, H - 4);
      });

      const totalDuration = (draws.length - 1) * 200 + 400 + 600;
      if (elapsed < totalDuration) {
        rafRef.current = requestAnimationFrame(drawFrame);
      }
    }

    function setup() {
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = CANVAS_HEIGHT;
      buildParticles(canvas.width, canvas.height);
      startTs = 0;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawFrame);
    }

    setup();

    const ro = new ResizeObserver(() => setup());
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [draws, userScore]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: `${CANVAS_HEIGHT}px` }}
      aria-label="Express Entry draw history visualized as particle clouds"
    />
  );
}
