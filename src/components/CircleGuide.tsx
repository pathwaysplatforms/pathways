interface CircleGuideProps {
  cx: number;
  cy: number;
  /** Base radius for the outermost circle. Inner circles are 0.65× and 0.85× of this. */
  r: number;
  className?: string;
}

/** Three concentric hairline circles — decorative guide overlay for the hero globe. */
export function CircleGuide({ cx, cy, r, className }: CircleGuideProps) {
  const stroke = "rgba(0,0,0,0.06)";
  return (
    <svg
      className={className}
      viewBox={`0 0 ${cx * 2} ${cy * 2}`}
      fill="none"
      aria-hidden="true"
    >
      <circle cx={cx} cy={cy} r={r * 0.65} stroke={stroke} strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r * 0.85} stroke={stroke} strokeWidth="0.5" />
      <circle cx={cx} cy={cy} r={r}        stroke={stroke} strokeWidth="0.5" />
    </svg>
  );
}
