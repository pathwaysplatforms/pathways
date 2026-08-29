/** Sine-wave halftone dot grid — used as a subtle decorative background overlay. */
export function HalftoneTexture() {
  const spacing = 16;
  const cols = 90;
  const rows = 50;

  const circles: { x: number; y: number; r: number }[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = col * spacing;
      const y = row * spacing;
      const r = Math.max(0.1, 0.5 + 1.5 * Math.sin(x / 40) * Math.sin(y / 40));
      circles.push({ x, y, r });
    }
  }

  const vw = cols * spacing;
  const vh = rows * spacing;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0.08,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {circles.map(({ x, y, r }, i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#1A1A1A" />
        ))}
      </svg>
    </div>
  );
}
