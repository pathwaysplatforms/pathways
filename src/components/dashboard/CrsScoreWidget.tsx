import Link from "next/link";
import type { DashboardUserProfile, DrawData } from "@/modules/dashboard/types";

/** SVG sparkline with area fill and dot markers at each data point. */
function Sparkline({ history }: { history: DashboardUserProfile["crs_history"] }) {
  const scores = history.map((h) => h.score);
  const W = 320;
  const H = 56;
  const margin = 4;
  const min = Math.min(...scores) - margin;
  const max = Math.max(...scores) + margin;
  const range = max - min || 1;

  const coords = scores.map((score, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - ((score - min) / range) * H;
    return { x, y };
  });

  const linePath = coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b3d2a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1b3d2a" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill="url(#sparkFill)" />

      {/* Line */}
      <path
        d={linePath}
        stroke="#1b3d2a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data-point dots */}
      {coords.map((p, i) => {
        const isLast = i === coords.length - 1;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={isLast ? 3.5 : 2}
            fill={isLast ? "#1b3d2a" : "#ffffff"}
            stroke="#1b3d2a"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

/** Dashboard widget showing the user's current CRS score and recent score history. */
export function CrsScoreWidget({
  profile,
  draw,
}: {
  profile: DashboardUserProfile;
  draw: DrawData;
}) {
  const { crs_score, crs_history } = profile;
  const latestMonth = crs_history[crs_history.length - 1]?.month ?? "";

  return (
    <Link href="/crs" className="card-glass p-7 flex flex-col gap-4 block">
      {/* Label */}
      <p className="font-dm-mono text-xs text-pine uppercase tracking-widest">
        CRS Score Estimate
      </p>

      {/* Score */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-jakarta text-7xl text-pine leading-none tracking-tight">
            {crs_score}
          </span>
        </div>
        <p className="font-dm-sans text-sm text-neutral-400 mt-1">
          Top 15% of current pool
        </p>
      </div>

      {/* Sparkline + month labels */}
      <div className="w-full">
        <Sparkline history={crs_history} />
        <div className="flex justify-between mt-1">
          {crs_history.map((h) => (
            <span key={h.month} className="font-dm-mono text-xs text-neutral-400">
              {h.month}
            </span>
          ))}
        </div>
      </div>

      {/* Next draw pill */}
      <div className="mt-auto">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pine/10 border border-pine/12 font-dm-mono text-xs text-pine">
          <span className="w-1.5 h-1.5 rounded-full bg-pine flex-shrink-0" />
          Next draw ~Jun 3 · {draw.estimated_minimum_crs} est. min. · {latestMonth}
        </span>
      </div>
    </Link>
  );
}
