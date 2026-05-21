import Link from "next/link";
import type { DashboardUserProfile } from "@/modules/dashboard/types";

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

/** Circular SVG progress ring showing documents ready vs total. */
function ProgressRing({ ready, total }: { ready: number; total: number }) {
  const progress = ready / (total || 1);
  const dashOffset = RING_C * (1 - progress);

  return (
    <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
      <svg
        width="110"
        height="110"
        viewBox="0 0 110 110"
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="55"
          cy="55"
          r={RING_R}
          fill="none"
          stroke="#efeee9"
          strokeWidth="6"
        />
        <circle
          cx="55"
          cy="55"
          r={RING_R}
          fill="none"
          stroke="#1b3d2a"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="absolute font-dm-mono text-xs text-pine font-medium">
        {ready} / {total}
      </span>
    </div>
  );
}

/** Dashboard widget showing document completion progress. */
export function DocumentsWidget({ profile }: { profile: DashboardUserProfile }) {
  const { documents_ready, documents_total } = profile;
  const remaining = documents_total - documents_ready;

  return (
    <div className="card-glass p-7 flex flex-col gap-4">
      {/* Decorative teal-to-coral blob */}
      <div className="tile-blob-docs" aria-hidden="true" />

      {/* Label */}
      <p className="font-dm-mono text-xs text-pine uppercase tracking-widest">
        Documents Ready
      </p>

      {/* Large count + ring */}
      <div className="flex items-center gap-5">
        <div className="flex items-baseline gap-1.5 font-jakarta tracking-tight">
          <span className="text-6xl text-pine leading-none">{documents_ready}</span>
          <span className="text-3xl text-neutral-300">/</span>
          <span className="text-3xl text-neutral-300">{documents_total}</span>
        </div>
        <ProgressRing ready={documents_ready} total={documents_total} />
      </div>

      {/* Meta */}
      <p className="font-dm-sans text-sm text-neutral-400">
        {remaining} document{remaining !== 1 ? "s" : ""} still needed
      </p>

      {/* CTA */}
      <div className="mt-auto pt-1">
        <Link
          href="/documents"
          className="font-dm-sans text-sm text-pine underline underline-offset-2 decoration-pine/35 hover:decoration-pine transition-colors"
        >
          Get help preparing →
        </Link>
      </div>
    </div>
  );
}
