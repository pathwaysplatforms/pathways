import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/modules/auth/service";
import { getT } from "@/lib/i18n";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PathwayInput } from "@/lib/pathway-input";
import { MatchesCTA } from "@/components/onboarding/MatchesCTA";

/** Fetch the first active pathway slug to pre-select when the user clicks the CTA. */
async function fetchTopPathwaySlug(): Promise<string | null> {
  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data } = await db
    .from("pathways")
    .select("slug")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { slug: string } | null)?.slug ?? null;
}

/** Polished transition screen shown after the user confirms their review. */
export default async function MatchesPage() {
  const t = await getT();
  const profile = await getProfile();

  if (!profile || profile.onboarding_step !== "complete") {
    redirect("/onboarding/voice");
  }

  const pathwayInput = (profile.pathway_input_json as PathwayInput | null) ?? null;
  const topPathwaySlug = await fetchTopPathwaySlug();

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{ background: "var(--pw-bg)", fontFamily: "var(--pw-font-body)" }}
    >
      <div className="w-full max-w-lg">

        {/* Back to marketing site */}
        <a
          href={process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001"}
          className="inline-block mb-8 text-xs text-pw-muted hover:text-pw-ink transition-colors"
          style={{ textDecoration: "none" }}
        >
          ← Back to pathways.app
        </a>

        {/* Wordmark */}
        <div className="mb-12">
          <span
            className="text-pw-ink text-lg"
            style={{ fontFamily: "var(--pw-font-display)" }}
          >
            Pathways
          </span>
        </div>

        <hr className="pw-rule mb-10" />

        {/* Eyebrow + Headline */}
        <p className="pw-eyebrow mb-4">Onboarding complete</p>
        <h1
          className="text-3xl md:text-4xl text-pw-ink mb-3 leading-tight"
          style={{ fontFamily: "var(--pw-font-display)", fontWeight: 400 }}
        >
          {t("matches_title")}
        </h1>
        <p className="text-pw-muted text-sm leading-relaxed mb-10">
          {t("matches_subtitle")}
        </p>

        {/* Profile summary */}
        {pathwayInput && (
          <div className="pw-card p-6 mb-6">
            <p className="pw-eyebrow mb-4">Profile summary</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
              <SummaryRow label="Completeness" value={`${pathwayInput.data_completeness_pct}%`} />
            </div>
          </div>
        )}

        {/* What happens next */}
        <div className="pw-card p-6 mb-10">
          <p className="pw-eyebrow mb-4">What happens next</p>
          <ol className="space-y-4">
            {[
              "Our engine checks your eligibility against every active Canadian pathway",
              "You'll see a prioritised list of pathways you qualify for on your dashboard",
              "Each pathway comes with a step-by-step checklist and document tracker",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-pw-muted">
                <span className="shrink-0 w-5 h-5 rounded-full border border-black/[0.08] flex items-center justify-center text-xs" style={{ color: "var(--pw-ink)" }}>
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* CTA */}
        <MatchesCTA label={t("matches_go_dashboard")} topPathwaySlug={topPathwaySlug} />

        {/* Dev-only raw JSON */}
        {process.env.NODE_ENV === "development" && pathwayInput && (
          <details className="mt-8 text-xs">
            <summary className="cursor-pointer text-pw-muted hover:text-pw-ink">
              pathway_input_json (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-pw-surface rounded overflow-auto text-pw-muted max-h-80">
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
      <p className="pw-eyebrow mb-0.5">{label}</p>
      <p
        className="text-sm truncate"
        style={{ color: accent ? "var(--pw-accent)" : "var(--pw-ink)" }}
      >
        {value}
      </p>
    </div>
  );
}
