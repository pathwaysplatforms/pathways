import { redirect } from "next/navigation";
import { getProfile } from "@/modules/auth/service";
import type { PathwayInput } from "@/lib/pathway-input";
import { OnboardingMatchesClient } from "@/components/onboarding/OnboardingMatchesClient";
import type { SubscriptionStatus } from "@/modules/account/types";

/** Pathway matches shown after onboarding completes. */
export default async function MatchesPage() {
  const profile = await getProfile();

  if (!profile || profile.onboarding_step !== "complete") {
    redirect("/onboarding/voice");
  }

  const pathwayInput = (profile.pathway_input_json as PathwayInput | null) ?? null;
  const validStatuses: SubscriptionStatus[] = ["guest", "free", "paid"];
  const subscriptionStatus: SubscriptionStatus = validStatuses.includes(
    profile.subscription_status as SubscriptionStatus
  )
    ? (profile.subscription_status as SubscriptionStatus)
    : "free";

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--pw-bg)", fontFamily: "var(--pw-font-body)" }}
    >
      {/* Pathways wordmark — aligned with content column, below fixed banner */}
      <div style={{ width: "100%", padding: "52px 16px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <span
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: 19,
              color: "var(--pw-ink)",
            }}
          >
            Pathways
          </span>
        </div>
      </div>

      {/* Centered page content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0 16px 64px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 780 }}>
          {/* Page header */}
          <div style={{ paddingTop: 40, marginBottom: 36 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--pw-muted)",
                fontFamily: "var(--pw-font-body)",
                marginBottom: 8,
              }}
            >
              Onboarding complete
            </p>
            <h1
              style={{
                fontFamily: "var(--pw-font-display)",
                fontSize: "clamp(2.2rem, 5.5vw, 3.1rem)",
                fontWeight: 500,
                color: "var(--pw-ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1.12,
                marginBottom: 14,
              }}
            >
              Your Canadian pathways
            </h1>
            <p style={{ fontSize: 16, color: "var(--pw-muted)", lineHeight: 1.65 }}>
              Based on your answers, here are your top immigration options.
              Upgrade to unlock full details, track your application, and upload documents.
            </p>
          </div>

          {/* Profile summary card */}
          {pathwayInput && (
            <div className="pw-card" style={{ padding: "22px 24px", marginBottom: 28 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--pw-muted)",
                  fontFamily: "var(--pw-font-body)",
                  marginBottom: 16,
                }}
              >
                Profile summary
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
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
                  value={`${pathwayInput.crs_estimate.range_low}–${pathwayInput.crs_estimate.range_high}`}
                  accent
                />
                <SummaryRow
                  label="Profile completeness"
                  value={`${pathwayInput.data_completeness_pct}%`}
                />
              </div>
            </div>
          )}

          {/* Match results — loading animation + cards + paywall */}
          <OnboardingMatchesClient subscriptionStatus={subscriptionStatus} />
        </div>
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
      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--pw-muted)",
          fontFamily: "var(--pw-font-body)",
          marginBottom: 3,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 14,
          fontFamily: "var(--pw-font-body)",
          color: accent ? "var(--pw-accent)" : "var(--pw-ink)",
          fontWeight: accent ? 500 : 400,
        }}
      >
        {value}
      </p>
    </div>
  );
}
