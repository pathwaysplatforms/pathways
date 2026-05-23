import Link from "next/link";
import type { DashboardUserProfile, DrawData } from "@/modules/dashboard/types";

/** Returns the number of whole days from today until the given ISO date string. */
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
}

/** Dashboard widget showing the next Express Entry draw countdown and recent draw history. */
export function NextDrawWidget({
  profile,
  draw,
}: {
  profile: DashboardUserProfile;
  draw: DrawData;
}) {
  const { crs_score } = profile;
  const { next_draw_date, estimated_minimum_crs, history } = draw;

  const days = daysUntil(next_draw_date);
  const pointsBelow = estimated_minimum_crs - crs_score;
  const isBelowEstimate = pointsBelow > 0;

  return (
    <div className="card-glass p-7 flex flex-col gap-4">
      {/* Label */}
      <p className="font-dm-mono text-xs text-pine uppercase tracking-widest">
        Next Express Entry Draw
      </p>

      {/* Countdown */}
      <div>
        <div className="flex items-baseline gap-3">
          <span className="font-jakarta text-8xl text-neutral-900 leading-none tracking-tight tabular-nums">
            {days}
          </span>
          <span className="font-dm-mono text-sm text-neutral-400 uppercase tracking-wider">
            days
          </span>
        </div>
        <p className="font-dm-sans text-sm text-neutral-400 mt-2">
          Estimated minimum CRS: {estimated_minimum_crs} · All-program draw
        </p>
      </div>

      {/* Draw history table */}
      <div className="border-t border-black/5 mt-1">
        {history.map((row) => (
          <div
            key={row.date}
            className="grid gap-3.5 py-2 border-b border-black/5 last:border-0 font-dm-mono text-xs"
            style={{ gridTemplateColumns: "80px 1fr auto" }}
          >
            <span className="text-neutral-400">{row.date}</span>
            <span className="text-neutral-500">{row.type}</span>
            <span className="text-neutral-900 font-medium">{row.crs}</span>
          </div>
        ))}
      </div>

      {/* Amber warning — dot style */}
      {isBelowEstimate && (
        <div className="flex items-center gap-2.5 text-warning">
          <span
            className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0"
            style={{ boxShadow: "0 0 0 4px rgba(217,119,6,0.14)" }}
            aria-hidden="true"
          />
          <span className="font-dm-sans text-sm font-medium">
            Your score is {pointsBelow} point{pointsBelow !== 1 ? "s" : ""} below the estimate
          </span>
        </div>
      )}

      {/* Link */}
      <Link
        href="/draws"
        className="font-dm-sans text-sm text-pine underline underline-offset-2 decoration-pine/35 hover:decoration-pine transition-colors mt-auto"
      >
        Improve your score →
      </Link>
    </div>
  );
}
