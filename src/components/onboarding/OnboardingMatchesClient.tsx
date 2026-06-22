"use client";

import { useState, useEffect } from "react";
import { Check, Clock, Lock, ArrowRight, X } from "lucide-react";
import type { PathwayMatchResult, PathwayRecommendation } from "@/types/pathways";
import { UpgradeModal, usePaywall } from "@/components/paywall/UpgradeModal";
import type { SubscriptionStatus } from "@/modules/account/types";

// ─── Design tokens (website language) ────────────────────────────────────────
const W = {
  green:   "#0D4A3A",
  muted:   "#2A5C4E",
  light:   "#E8F0EE",
  ink:     "#0D0D0D",
  grey:    "#6B6B6B",
  border:  "rgba(0,0,0,0.08)",
  display: "var(--pw-font-display)",
  body:    "var(--pw-font-body)",
} as const;

const PATHWAY_TYPE_LABELS: Record<PathwayRecommendation["pathway_type"], string> = {
  permanent_residency: "Permanent Residency",
  work_permit:         "Work Permit",
  study:               "Study",
  citizenship:         "Citizenship",
  family:              "Family",
};

const MATCH_BADGE: Record<PathwayRecommendation["match_label"], { bg: string; color: string; border?: string }> = {
  "Excellent match": { bg: W.ink,           color: "#fff" },
  "Good match":      { bg: "transparent",   color: W.ink,   border: "1px solid rgba(0,0,0,0.18)" },
  "Possible match":  { bg: "#F4F4F4",       color: W.grey },
};

const ANALYSIS_STEPS = [
  "Reading your profile",
  "Matching immigration programs",
  "Ranking your results",
] as const;

type Phase = "analyzing" | "done" | "error";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thin upgrade-nag banner pinned to the top of the viewport. */
function UpgradeBanner({ onUpgrade, onDismiss }: { onUpgrade: () => void; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: W.green,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "10px 20px",
        fontFamily: W.body,
      }}
    >
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.4 }}>
        <Lock
          size={11}
          color="rgba(255,255,255,0.6)"
          style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}
        />
        Upgrade for full access — step-by-step tracking, document uploads, and unlimited pathways.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: W.body,
          color: W.green,
          backgroundColor: "#fff",
          border: "none",
          borderRadius: 9999,
          padding: "5px 14px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Upgrade →
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss banner"
        style={{
          position: "absolute",
          right: 14,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.5)",
          display: "flex",
          alignItems: "center",
          padding: 4,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Three shimmer skeleton cards shown while matching runs. */
function SkeletonCards({ stepIndex }: { stepIndex: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            backgroundColor: "#fff",
            border: `1px solid ${W.border}`,
            borderRadius: 16,
            padding: 24,
            opacity: 1 - i * 0.12,
          }}
        >
          {/* Badge + title row */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <div className="pw-shimmer" style={{ height: 11, width: 120, borderRadius: 6, marginBottom: 8 }} />
              <div className="pw-shimmer" style={{ height: 22, width: 220, borderRadius: 8 }} />
            </div>
            <div className="pw-shimmer" style={{ height: 24, width: 90, borderRadius: 9999, flexShrink: 0 }} />
          </div>
          {/* Body text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            <div className="pw-shimmer" style={{ height: 13, width: "100%", borderRadius: 6 }} />
            <div className="pw-shimmer" style={{ height: 13, width: "88%", borderRadius: 6 }} />
            <div className="pw-shimmer" style={{ height: 13, width: "72%", borderRadius: 6 }} />
          </div>
          {/* Requirements */}
          {[0, 1, 2].map((j) => (
            <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div className="pw-shimmer" style={{ width: 16, height: 16, borderRadius: 9999, flexShrink: 0 }} />
              <div className="pw-shimmer" style={{ height: 13, width: `${75 - j * 10}%`, borderRadius: 6 }} />
            </div>
          ))}
          {/* Footer */}
          <div style={{ borderTop: `1px solid ${W.border}`, paddingTop: 14, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <div className="pw-shimmer" style={{ height: 12, width: 100, borderRadius: 6 }} />
            <div className="pw-shimmer" style={{ height: 12, width: 90, borderRadius: 6 }} />
          </div>
        </div>
      ))}

      {/* Analysis steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, paddingLeft: 4 }}>
        {ANALYSIS_STEPS.map((step, i) => {
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <div
              key={step}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "opacity 0.3s",
                opacity: isDone || isActive ? 1 : 0.35,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9999,
                  border: isDone ? "none" : `1.5px solid ${isActive ? W.green : "rgba(0,0,0,0.15)"}`,
                  backgroundColor: isDone ? W.green : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background-color 0.3s",
                }}
              >
                {isDone && <Check size={10} color="#fff" strokeWidth={2.5} />}
                {isActive && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 9999,
                      backgroundColor: W.green,
                      animation: "pulse 1.2s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: W.body,
                  color: isActive ? W.ink : isDone ? W.grey : "rgba(0,0,0,0.3)",
                  fontWeight: isActive ? 500 : 400,
                  transition: "color 0.3s",
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One pathway match card — clicks trigger the paywall for non-paid users. */
function PathwayCard({
  pw,
  rank,
  onGate,
  revealDelay,
}: {
  pw: PathwayRecommendation;
  rank: number;
  onGate: () => void;
  revealDelay: number;
}) {
  const [hovered, setHovered] = useState(false);
  const badge = MATCH_BADGE[pw.match_label];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onGate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onGate(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pw-card-reveal"
      style={{
        animationDelay: `${revealDelay}ms`,
        backgroundColor: "#fff",
        border: `1px solid ${W.border}`,
        borderRadius: 16,
        padding: 24,
        cursor: "pointer",
        transition: "box-shadow 0.2s, transform 0.2s",
        boxShadow: hovered ? "0 10px 40px rgba(0,0,0,0.10)" : "0 2px 10px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        outline: "none",
      }}
    >
      {/* Rank + header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9999,
            backgroundColor: rank === 1 ? W.green : "rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, fontFamily: W.body, color: rank === 1 ? "#fff" : W.grey }}>
            {rank}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontFamily: W.body, color: W.grey, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                {pw.flag_emoji} {pw.country_name} · {PATHWAY_TYPE_LABELS[pw.pathway_type]}
              </p>
              <h3
                style={{
                  fontFamily: W.display,
                  fontSize: "clamp(1.05rem, 2.5vw, 1.3rem)",
                  fontWeight: 400,
                  color: W.ink,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                {pw.pathway_name}
              </h3>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 500,
                fontFamily: W.body,
                flexShrink: 0,
                backgroundColor: badge.bg,
                color: badge.color,
                border: badge.border,
              }}
            >
              {pw.match_label}
            </span>
          </div>
        </div>
      </div>

      {/* Why it fits */}
      <p style={{ fontSize: 13, fontFamily: W.body, color: W.grey, lineHeight: 1.65, marginBottom: 14 }}>
        {pw.why_it_fits}
      </p>

      {/* Key requirements */}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        {pw.key_requirements.slice(0, 3).map((req) => (
          <li
            key={req}
            style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, fontFamily: W.body, color: W.ink }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 9999,
                backgroundColor: W.light,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Check size={9} color={W.green} strokeWidth={2.5} />
            </span>
            {req}
          </li>
        ))}
      </ul>

      {/* Footer row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 14,
          borderTop: `1px solid ${W.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: W.body, color: W.grey }}>
          <Clock size={12} />
          {pw.estimated_timeline}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontFamily: W.body,
            color: hovered ? W.muted : W.green,
            fontWeight: 500,
            transition: "color 0.15s",
          }}
        >
          <Lock size={11} />
          View full details
          <ArrowRight size={11} />
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  subscriptionStatus: SubscriptionStatus;
}

/** Manages pathway matching fetch, loading animation, card display, and paywall. */
export function OnboardingMatchesClient({ subscriptionStatus }: Props) {
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState<PathwayMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isPaid = subscriptionStatus === "paid";
  const { open: paywallOpen, featureName: paywallFeature, show: showPaywall, hide: hidePaywall } = usePaywall();

  useEffect(() => {
    // Step 0 → 1 after 1.1s, step 1 → 2 after 2.8s. Step 2 stays until API responds.
    const t1 = setTimeout(() => setStepIndex(1), 1100);
    const t2 = setTimeout(() => setStepIndex(2), 2800);

    fetch("/api/pathways/match", { method: "POST" })
      .then((r) => r.json())
      .then((body: { data: PathwayMatchResult | null; error?: { message: string } }) => {
        clearTimeout(t1);
        clearTimeout(t2);
        if (body.error) {
          setError(body.error.message);
          setPhase("error");
          return;
        }
        setStepIndex(ANALYSIS_STEPS.length); // all complete
        // Brief pause so user sees all steps complete, then reveal
        setTimeout(() => setPhase("done"), 600);
      })
      .catch((err: unknown) => {
        clearTimeout(t1);
        clearTimeout(t2);
        setError(err instanceof Error ? err.message : "Could not load your matches.");
        setPhase("error");
      });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Re-fetch results after phase changes to done
  useEffect(() => {
    if (phase !== "done") return;
    fetch("/api/pathways/match")
      .then((r) => r.json())
      .then((body: { data: PathwayMatchResult | null }) => {
        if (body.data) setResults(body.data);
      })
      .catch(() => {
        // Results were cached by POST — GET might fail; show static fallback
      });
  }, [phase]);

  function handleCardClick() {
    if (isPaid) return; // paid users pass through (future: navigate to pathway)
    showPaywall("pathway details");
  }

  const showBanner = !isPaid && !bannerDismissed;

  return (
    <>
      {/* Sticky upgrade banner */}
      {showBanner && (
        <UpgradeBanner
          onUpgrade={() => showPaywall("full access")}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Banner spacer — pushes page content down when banner is visible */}
      <div
        aria-hidden="true"
        style={{
          height: showBanner ? 44 : 0,
          transition: "height 0.25s",
          flexShrink: 0,
        }}
      />

      {/* Section heading */}
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: phase === "done" ? W.green : W.grey,
            fontFamily: W.body,
            marginBottom: 8,
            transition: "color 0.4s",
          }}
        >
          {phase === "analyzing" ? "Analysing your profile…" : "Your pathway matches"}
        </p>
        {phase === "done" && results && (
          <p style={{ fontSize: 14, fontFamily: W.body, color: W.grey, lineHeight: 1.6 }}>
            {results.summary}
          </p>
        )}
      </div>

      {/* Content area */}
      {phase === "analyzing" && <SkeletonCards stepIndex={stepIndex} />}

      {phase === "error" && (
        <div
          style={{
            backgroundColor: "#fff",
            border: `1px solid ${W.border}`,
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 15, fontFamily: W.body, color: W.ink, marginBottom: 6 }}>
            Couldn&apos;t load your matches
          </p>
          <p style={{ fontSize: 13, fontFamily: W.body, color: W.grey, marginBottom: 20 }}>
            {error ?? "Something went wrong. Head to your dashboard — your results will be ready there."}
          </p>
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 22px",
              borderRadius: 9999,
              backgroundColor: W.ink,
              color: "#fff",
              fontSize: 14,
              fontFamily: W.body,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Go to dashboard <ArrowRight size={14} />
          </a>
        </div>
      )}

      {phase === "done" && results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {results.top_pathways.map((pw, i) => (
            <PathwayCard
              key={pw.pathway_id}
              pw={pw}
              rank={i + 1}
              onGate={handleCardClick}
              revealDelay={i * 120}
            />
          ))}

          {/* Bottom CTA */}
          <div
            style={{
              marginTop: 8,
              padding: "20px 24px",
              borderRadius: 16,
              backgroundColor: W.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, fontFamily: W.body, color: "#fff", marginBottom: 3 }}>
                Get the full picture
              </p>
              <p style={{ fontSize: 13, fontFamily: W.body, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
                Unlock step-by-step checklists, document tracking, and priority support.
              </p>
            </div>
            <button
              type="button"
              onClick={() => showPaywall("full access")}
              style={{
                flexShrink: 0,
                padding: "10px 20px",
                borderRadius: 9999,
                backgroundColor: "#fff",
                color: W.green,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: W.body,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Upgrade to Pro →
            </button>
          </div>

          {/* Dashboard fallback link */}
          <p style={{ textAlign: "center", fontSize: 13, fontFamily: W.body, color: W.grey }}>
            Or{" "}
            <a href="/dashboard" style={{ color: W.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>
              continue to your dashboard
            </a>{" "}
            — your results are saved there.
          </p>
        </div>
      )}

      {/* Paywall modal */}
      <UpgradeModal
        open={paywallOpen}
        onClose={hidePaywall}
        featureName={paywallFeature}
      />
    </>
  );
}
