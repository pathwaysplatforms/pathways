"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Lock, ArrowRight, X, Loader2 } from "lucide-react";
import type { PathwayMatchResult, PathwayRecommendation } from "@/types/pathways";
import { UpgradeModal, usePaywall } from "@/components/paywall/UpgradeModal";
import type { SubscriptionStatus } from "@/modules/account/types";
import { selectPathway } from "@/app/actions/pathway";

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

const LOADING_MESSAGES = [
  "Reading your profile",
  "Assessing eligibility criteria",
  "Scanning immigration programs",
  "Calculating match scores",
  "Weighing your qualifications",
  "Ranking your pathways",
  "Preparing your results",
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
        backgroundColor: "#00C950",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "7px 20px",
        fontFamily: W.body,
      }}
    >
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.92)", margin: 0, lineHeight: 1.4 }}>
        <Lock
          size={10}
          color="rgba(255,255,255,0.65)"
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
          color: "#00C950",
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
          color: "rgba(255,255,255,0.85)",
          display: "flex",
          alignItems: "center",
          padding: 4,
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Full-viewport centered loading animation shown while pathway matching runs. */
function MatchingLoader() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
        setVisible(true);
      }, 320);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 480,
        padding: "60px 20px",
        userSelect: "none",
      }}
    >
      {/* Pulsing rings */}
      <div style={{ position: "relative", width: 88, height: 88, marginBottom: 48 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "1.5px solid rgba(0,0,0,0.18)",
              animation: `pw-ring-pulse 2.8s cubic-bezier(0.2, 0.6, 0.4, 1) ${i * 0.75}s infinite`,
            }}
          />
        ))}
        {/* Centre dot */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: W.ink,
            animation: "pw-dot-breathe 2.8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Rotating message */}
      <p
        style={{
          fontFamily: W.body,
          fontSize: 15,
          color: W.ink,
          letterSpacing: "-0.01em",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 0.32s ease, transform 0.32s ease",
          marginBottom: 10,
          textAlign: "center",
        }}
      >
        {LOADING_MESSAGES[msgIndex]}
      </p>
      <p
        style={{
          fontFamily: W.body,
          fontSize: 13,
          color: W.grey,
          textAlign: "center",
        }}
      >
        Finding the best pathways for your profile…
      </p>
    </div>
  );
}

/** One pathway match card — clicking selects the pathway for any user. */
function PathwayCard({
  pw,
  rank,
  onSelect,
  revealDelay,
  isPaid,
  isSelecting,
}: {
  pw: PathwayRecommendation;
  rank: number;
  onSelect: (slug: string) => void;
  revealDelay: number;
  isPaid: boolean;
  isSelecting: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const badge = MATCH_BADGE[pw.match_label];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(pw.pathway_id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(pw.pathway_id); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="pw-card-reveal"
      style={{
        animationDelay: `${revealDelay}ms`,
        backgroundColor: "#fff",
        border: `1px solid ${hovered ? "rgba(0,0,0,0.13)" : W.border}`,
        borderRadius: 16,
        padding: 28,
        cursor: "pointer",
        transition: "box-shadow 0.1s ease, transform 0.1s ease, border-color 0.1s ease",
        boxShadow: hovered ? "0 20px 56px rgba(0,0,0,0.15)" : "0 2px 12px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-5px)" : "translateY(0)",
        outline: "none",
      }}
    >
      {/* Rank + header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            backgroundColor: rank === 1 ? W.green : "rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, fontFamily: W.body, color: rank === 1 ? "#fff" : W.grey }}>
            {rank}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, fontFamily: W.body, color: W.grey, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                {pw.flag_emoji} {pw.country_name} · {PATHWAY_TYPE_LABELS[pw.pathway_type]}
              </p>
              <h3
                style={{
                  fontFamily: W.display,
                  fontSize: "clamp(1.1rem, 2.5vw, 1.45rem)",
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
                padding: "5px 12px",
                borderRadius: 9999,
                fontSize: 12,
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
      <p style={{ fontSize: 14, fontFamily: W.body, color: W.grey, lineHeight: 1.65, marginBottom: 16 }}>
        {pw.why_it_fits}
      </p>

      {/* Key requirements */}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {pw.key_requirements.slice(0, 3).map((req) => (
          <li
            key={req}
            style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, fontFamily: W.body, color: W.ink }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 9999,
                backgroundColor: W.light,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Check size={10} color={W.green} strokeWidth={2.5} />
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
          paddingTop: 16,
          borderTop: `1px solid ${W.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: W.body, color: W.grey }}>
          <Clock size={13} />
          {pw.estimated_timeline}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            fontFamily: W.body,
            color: isSelecting ? W.grey : hovered ? W.muted : W.green,
            fontWeight: 500,
            transition: "color 0.1s",
          }}
        >
          {isSelecting
            ? <><Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> Selecting…</>
            : <>{isPaid ? "Start with this pathway" : "Select this pathway"} <ArrowRight size={12} /></>
          }
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
  const [results, setResults] = useState<PathwayMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  const isPaid = subscriptionStatus === "paid";
  const router = useRouter();
  const { open: paywallOpen, featureName: paywallFeature, show: showPaywall, hide: hidePaywall } = usePaywall();

  useEffect(() => {
    fetch("/api/pathways/match", { method: "POST" })
      .then((r) => r.json())
      .then((body: { data: PathwayMatchResult | null; error?: { message: string } }) => {
        if (body.error) {
          setError(body.error.message);
          setPhase("error");
          return;
        }
        setTimeout(() => setPhase("done"), 400);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load your matches.");
        setPhase("error");
      });
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

  async function handleSelect(slug: string) {
    if (selecting) return;
    setSelecting(slug);
    try {
      await selectPathway(slug);
      router.push("/dashboard");
    } catch {
      setSelecting(null);
    }
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

      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
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
          <p style={{ fontSize: 15, fontFamily: W.body, color: W.grey, lineHeight: 1.6 }}>
            {results.summary}
          </p>
        )}
      </div>

      {/* Content area */}
      {phase === "analyzing" && <MatchingLoader />}

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
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {results.top_pathways.map((pw, i) => (
            <PathwayCard
              key={pw.pathway_id}
              pw={pw}
              rank={i + 1}
              onSelect={(slug) => void handleSelect(slug)}
              revealDelay={i * 120}
              isPaid={isPaid}
              isSelecting={selecting === pw.pathway_id}
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

          {/* Skip link */}
          <p style={{ textAlign: "center", fontSize: 13, fontFamily: W.body, color: W.grey }}>
            Not sure yet?{" "}
            <a href="/dashboard" style={{ color: W.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>
              Browse on your dashboard →
            </a>
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
