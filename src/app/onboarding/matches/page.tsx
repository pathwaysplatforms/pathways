import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";
import { getProfile } from "@/modules/auth/service";
import { getT } from "@/lib/i18n";
import type { PathwayInput } from "@/lib/pathway-input";

/** Polished transition screen shown after the user confirms their review. */
export default async function MatchesPage() {
  const t = await getT();
  const profile = await getProfile();
  if (!profile || profile.onboarding_step !== "complete") {
    redirect("/onboarding/voice");
  }

  const pathwayInput = (profile.pathway_input_json as PathwayInput | null) ?? null;

  return (
    <main className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <CheckCircle size={52} className="text-accent-500" />
        </div>

        {/* Headline */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            {t("matches_title")}
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            {t("matches_subtitle")}
          </p>
        </div>

        {/* Profile summary card */}
        {pathwayInput && (
          <div className="card p-gutter mb-6">
            <p className="label-eyebrow mb-3">Profile summary</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {pathwayInput.personal.nationality && (
                <SummaryRow label="Nationality" value={pathwayInput.personal.nationality} />
              )}
              {pathwayInput.personal.age > 0 && (
                <SummaryRow label="Age" value={`${pathwayInput.personal.age}`} />
              )}
              {pathwayInput.education.level_self_reported && (
                <SummaryRow label="Education" value={pathwayInput.education.level_self_reported} />
              )}
              {pathwayInput.work.occupation && (
                <SummaryRow label="Occupation" value={pathwayInput.work.occupation} />
              )}
              <SummaryRow
                label="CRS estimate"
                value={`${pathwayInput.crs_estimate.range_low} – ${pathwayInput.crs_estimate.range_high}`}
                accent
              />
              <SummaryRow
                label="Completeness"
                value={`${pathwayInput.data_completeness_pct}%`}
              />
            </div>
          </div>
        )}

        {/* What happens next */}
        <div className="card p-gutter mb-8">
          <p className="label-eyebrow mb-3">What happens next</p>
          <ol className="space-y-3">
            {[
              "Our engine checks your eligibility against every active Canadian pathway",
              "You'll see a prioritised list of pathways you qualify for on your dashboard",
              "Each pathway comes with a step-by-step checklist and document tracker",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-text-secondary">
                <span className="shrink-0 w-5 h-5 rounded-full bg-accent-50 text-accent-600 flex items-center justify-center text-xs font-medium">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          {t("matches_go_dashboard")}
          <ArrowRight size={16} />
        </Link>

        {/* Dev-only raw JSON */}
        {process.env.NODE_ENV === "development" && pathwayInput && (
          <details className="mt-8 text-xs">
            <summary className="cursor-pointer text-text-tertiary hover:text-text-secondary">
              pathway_input_json (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-bg-subtle rounded-input overflow-auto text-text-tertiary max-h-80">
              {JSON.stringify(pathwayInput, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-text-tertiary uppercase tracking-wide">{label}</p>
      <p className={`font-medium truncate ${accent ? "text-accent-600" : "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}
