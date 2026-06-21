"use client";

import "./PathwaysOrb.css";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface PathwaysOrbProps {
  state: OrbState;
  size?: number;
}

interface WaveformBarsProps {
  active: boolean;
}

const DURATION: Record<OrbState, number> = {
  idle: 18,
  listening: 5,
  thinking: 10,
  speaking: 7,
};

const SCALE: Record<OrbState, number> = {
  idle: 1,
  listening: 1.06,
  thinking: 0.97,
  speaking: 1.1,
};

/**
 * Light lavender orb with violet blobs.
 * Animation speed and scale change per state to signal the conversation phase visually.
 */
export function PathwaysOrb({ state, size = 220 }: PathwaysOrbProps) {
  const blurAmount = Math.max(size * 0.015, 4);
  const contrastAmount = Math.max(size * 0.008, 1.5);
  const dotSize = Math.max(size * 0.008, 0.1);
  const shadowSpread = Math.max(size * 0.008, 2);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        transition: "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        transform: `scale(${SCALE[state]})`,
        willChange: "transform",
      }}
    >
      <div
        className="pathways-orb"
        style={
          {
            position: "relative",
            width: "100%",
            height: "100%",
            "--ob": "#F5F3FF",
            "--c1": "rgba(83,74,183,0.72)",
            "--c2": "rgba(139,124,248,0.60)",
            "--c3": "rgba(83,74,183,0.42)",
            "--dur": `${DURATION[state]}s`,
            "--bl": `${blurAmount}px`,
            "--ct": contrastAmount,
            "--ds": `${dotSize}px`,
            "--ss": `${shadowSpread}px`,
          } as React.CSSProperties
        }
      >
      </div>
    </div>
  );
}

/** Five animated bars that pulse only during listening and speaking states. */
export function WaveformBars({ active }: WaveformBarsProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 28 }}>
      {([0, 1, 2, 3, 4] as const).map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: "var(--pw-accent)",
            opacity: active ? 0.7 : 0.2,
            height: active ? undefined : 4,
            animation: active
              ? `voice-bar ${0.8 + i * 0.15}s ease-in-out infinite`
              : undefined,
            animationDelay: active ? `${i * 0.12}s` : undefined,
            transition: "opacity 300ms ease",
          }}
        />
      ))}
    </div>
  );
}
