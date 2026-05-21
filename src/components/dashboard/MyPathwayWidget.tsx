import Link from "next/link";
import type { DashboardUserProfile } from "@/modules/dashboard/types";

const STEPS = ["Profile", "ITA", "Medical", "COPR", "Landing"] as const;

const PATHWAY_LABELS: Record<DashboardUserProfile["pathway"], string> = {
  express_entry_fswp: "Express Entry — FSWP",
  oinp_tech: "OINP — Tech Draw",
  family_sponsorship: "Family Sponsorship",
};

/** Dashboard widget showing the user's active pathway and 5-step progress timeline. */
export function MyPathwayWidget({ profile }: { profile: DashboardUserProfile }) {
  const { pathway, current_step, name } = profile;

  const completedPct = ((current_step - 1) / (STEPS.length - 1)) * 100;
  const trackGradient = `linear-gradient(90deg, #1b3d2a 0%, #1b3d2a ${completedPct}%, #e0ddd8 ${completedPct}%, #e0ddd8 100%)`;

  return (
    <div className="card-glass p-7 flex flex-col gap-5">
      {/* Decorative orange-to-blue blob */}
      <div className="tile-blob-pathway" aria-hidden="true" />

      {/* Header */}
      <div>
        <p className="font-dm-mono text-xs text-pine uppercase tracking-widest mb-3">
          My Pathway
        </p>
        <h2 className="font-jakarta text-2xl text-neutral-900">
          {PATHWAY_LABELS[pathway]}
        </h2>
        <p className="font-dm-sans text-sm text-neutral-400 mt-0.5">
          {name} · Canada
        </p>
      </div>

      {/* 5-step timeline */}
      <div className="relative mt-2 mb-1">
        {/* Track line */}
        <div
          className="absolute top-3 left-3.5 right-3.5 h-0.5 rounded"
          style={{ background: trackGradient }}
          aria-hidden="true"
        />

        {/* Step nodes */}
        <div className="relative grid grid-cols-5 z-10">
          {STEPS.map((step, i) => {
            const stepNum = i + 1;
            const isDone = stepNum < current_step;
            const isCurrent = stepNum === current_step;

            return (
              <div key={step} className="flex flex-col items-center gap-2.5">
                <div
                  className={[
                    "w-6 h-6 rounded-full flex items-center justify-center font-dm-mono text-xs",
                    isDone
                      ? "bg-[#b8c9be] text-white border-2 border-[#b8c9be]"
                      : isCurrent
                        ? "bg-pine text-white border-2 border-pine scale-110"
                        : "bg-white text-neutral-400 border-2 border-neutral-200",
                  ].join(" ")}
                  style={
                    isCurrent
                      ? { boxShadow: "0 0 0 4px rgba(27,61,42,0.10), 0 6px 16px -4px rgba(15,34,24,0.45)" }
                      : undefined
                  }
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isDone ? "✓" : stepNum}
                </div>
                <span
                  className={[
                    "font-dm-mono text-xs uppercase tracking-wide",
                    isCurrent ? "text-pine font-medium" : "text-neutral-400",
                  ].join(" ")}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <p className="font-dm-sans text-sm text-neutral-400">
          <span className="text-neutral-900 font-medium">Step {current_step} of {STEPS.length}</span>
          {" · "}Invitation to Apply received
        </p>
        <Link
          href="/pathway"
          className="pine-btn gap-2 px-5 py-2.5 rounded-xl font-dm-sans text-sm"
        >
          <span>Continue</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
