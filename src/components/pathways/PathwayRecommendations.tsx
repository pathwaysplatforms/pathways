"use client";

/**
 * PathwayRecommendations — Swiss Particle Brutalism stacked-card selector.
 * State machine: loading | empty | analyzing | results | error
 */

import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePathwayTransition } from "@/hooks/usePathwayTransition";
import type { PathwayMatchResult, PathwayRecommendation } from "@/types/pathways";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewState = "loading" | "empty" | "analyzing" | "results" | "error";
type MatchTier = "strong" | "borderline" | "unlikely";
type ExitDir = "left" | "right";

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYZING_STEPS: ReadonlyArray<{ label: string; completedAfterMs: number }> = [
  { label: "Reading your profile", completedAfterMs: 2000 },
  { label: "Searching immigration programs", completedAfterMs: 6000 },
  { label: "Ranking your matches", completedAfterMs: Infinity },
];

const PATHWAY_TYPE_LABELS: Record<PathwayRecommendation["pathway_type"], string> = {
  permanent_residency: "Permanent Residency",
  work_permit: "Work Permit",
  study: "Study",
  citizenship: "Citizenship",
  family: "Family",
};

const STACK_TRANSITION = "transform 420ms cubic-bezier(0.34, 1.2, 0.64, 1), opacity 420ms cubic-bezier(0.34, 1.2, 0.64, 1)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchLabelToTier(label: PathwayRecommendation["match_label"]): MatchTier {
  if (label === "Excellent match") return "strong";
  if (label === "Good match") return "borderline";
  return "unlikely";
}

function getTierBadgeStyle(tier: MatchTier): CSSProperties {
  switch (tier) {
    case "strong":
      return { background: "#0D0D0D", color: "#FFFFFF", border: "none" };
    case "borderline":
      return { background: "transparent", color: "#0D0D0D", border: "1px solid rgba(0,0,0,0.2)" };
    case "unlikely":
      return { background: "#F5F5F5", color: "#6B6B6B", border: "none" };
  }
}

function getTierLabel(tier: MatchTier): string {
  switch (tier) {
    case "strong":    return "Strong match";
    case "borderline": return "Good match";
    case "unlikely":  return "Possible match";
  }
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score, isActive }: { score: number; isActive: boolean }) {
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setBarWidth(0);
      return;
    }
    const t = setTimeout(() => setBarWidth(score), 50);
    return () => clearTimeout(t);
  }, [isActive, score]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <span
        style={{
          fontFamily: "var(--pw-font-display)",
          fontSize: "2.75rem",
          color: "#0D0D0D",
          lineHeight: 1,
          flexShrink: 0,
          fontWeight: 400,
        }}
      >
        {Math.round(score)}%
      </span>
      <div
        role="progressbar"
        aria-valuenow={Math.round(score)}
        aria-valuemax={100}
        style={{
          flex: 1,
          height: 3,
          background: "rgba(0,0,0,0.07)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barWidth}%`,
            background: "#0D0D0D",
            borderRadius: 2,
            transition: "width 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── PathwayCardContent ───────────────────────────────────────────────────────

function PathwayCardContent({
  pathway,
  cardIndex,
  total,
  isActive,
}: {
  pathway: PathwayRecommendation;
  cardIndex: number;
  total: number;
  isActive: boolean;
}) {
  const tier = matchLabelToTier(pathway.match_label);
  const badgeStyle = getTierBadgeStyle(tier);
  const tierText = getTierLabel(tier);
  const maxReqs = pathway.gap_analysis ? 3 : 4;
  const requirements = pathway.key_requirements.slice(0, maxReqs);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        userSelect: "none",
      }}
    >
      {/* Eyebrow */}
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#6B6B6B",
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        Pathway {cardIndex + 1} of {total} · {pathway.country_name}
      </p>

      {/* Pathway name */}
      <h2
        style={{
          fontFamily: "var(--pw-font-display)",
          fontSize: "1.25rem",
          color: "#0D0D0D",
          lineHeight: 1.2,
          margin: 0,
          fontWeight: 400,
        }}
      >
        {pathway.pathway_name}
      </h2>

      {/* Type + timeline */}
      <p
        style={{
          fontSize: 11,
          color: "#6B6B6B",
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        {PATHWAY_TYPE_LABELS[pathway.pathway_type]} · {pathway.estimated_timeline}
      </p>

      {/* Tier badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: 100,
          alignSelf: "flex-start",
          fontSize: 11,
          fontWeight: 500,
          fontFamily: "var(--pw-font-body)",
          ...badgeStyle,
        }}
      >
        <span style={{ fontSize: 6 }}>●</span>
        {tierText}
      </div>

      {/* Score + animated bar */}
      <ScoreBar score={pathway.match_score} isActive={isActive} />

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />

      {/* Requirements */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {requirements.map((req, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#0D0D0D",
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#0D0D0D",
                fontFamily: "var(--pw-font-body)",
                lineHeight: 1.5,
              }}
            >
              {req}
            </span>
          </div>
        ))}

        {pathway.gap_analysis && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#D4D4D4",
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: "#9B9B9B",
                fontFamily: "var(--pw-font-body)",
                lineHeight: 1.5,
              }}
            >
              {pathway.gap_analysis}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LoadingStack ─────────────────────────────────────────────────────────────

function LoadingStack() {
  const ghostStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    background: "#FFFFFF",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    height: 340,
  };

  return (
    <div
      aria-live="polite"
      aria-label="Loading pathway results"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}
    >
      <div style={{ position: "relative", width: "100%", height: 356 }}>
        <div style={{ ...ghostStyle, top: 16, transform: "scale(0.92)", opacity: 0.35 }} />
        <div style={{ ...ghostStyle, top: 8, transform: "scale(0.96)", opacity: 0.6 }} />
        <div
          className="animate-pulse"
          style={{ ...ghostStyle, top: 0 }}
        >
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ height: 10, width: 130, background: "rgba(0,0,0,0.06)", borderRadius: 4 }} />
            <div style={{ height: 22, width: "58%", background: "rgba(0,0,0,0.06)", borderRadius: 4 }} />
            <div style={{ height: 14, width: "35%", background: "rgba(0,0,0,0.06)", borderRadius: 4 }} />
            <div style={{ height: 26, width: 110, background: "rgba(0,0,0,0.06)", borderRadius: 100 }} />
            <div style={{ height: 44, width: "45%", background: "rgba(0,0,0,0.06)", borderRadius: 4 }} />
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />
            {[80, 65, 90, 72].map((w, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.08)",
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    height: 12,
                    width: `${w}%`,
                    background: "rgba(0,0,0,0.06)",
                    borderRadius: 4,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <p
        style={{
          fontFamily: "var(--pw-font-body)",
          fontSize: 13,
          color: "#6B6B6B",
          margin: 0,
        }}
      >
        Analysing your profile…
      </p>
    </div>
  );
}

// ─── AnalyzingState ───────────────────────────────────────────────────────────

function AnalyzingState({ completedSteps }: { completedSteps: Set<number> }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const t1 = setTimeout(() => setVisibleCount(2), 300);
    const t2 = setTimeout(() => setVisibleCount(3), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-label="Analyzing your profile"
      style={{ padding: "80px 0", display: "flex", flexDirection: "column", gap: 20 }}
    >
      <h2
        style={{
          fontFamily: "var(--pw-font-display)",
          fontSize: "1.5rem",
          fontWeight: 400,
          color: "#0D0D0D",
          margin: "0 0 8px",
        }}
      >
        Analysing your profile…
      </h2>

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {ANALYZING_STEPS.map((step, i) => {
          const done = completedSteps.has(i);
          const active = !done && (i === 0 || completedSteps.has(i - 1));
          const visible = i < visibleCount;

          return (
            <li
              key={step.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: visible ? 1 : 0,
                transition: "opacity 300ms ease-out",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--pw-font-body)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: done ? "#9B9B9B" : active ? "#0D0D0D" : "#9B9B9B",
                  minWidth: 20,
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontFamily: "var(--pw-font-body)",
                  color: done ? "#9B9B9B" : active ? "#0D0D0D" : "#6B6B6B",
                  flex: 1,
                }}
              >
                {step.label}
              </span>
              {done && (
                <span style={{ fontSize: 12, color: "#9B9B9B", flexShrink: 0 }}>✓</span>
              )}
              {active && (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid rgba(0,0,0,0.12)",
                    borderTopColor: "#0D0D0D",
                    animation: "pw-spin 0.8s linear infinite",
                    flexShrink: 0,
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      <style>{`@keyframes pw-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── CardStack ────────────────────────────────────────────────────────────────

function CardStack({
  pathways,
  onReEvaluate,
}: {
  pathways: PathwayRecommendation[];
  onReEvaluate: () => void;
}) {
  const n = pathways.length;
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exitingIndex, setExitingIndex] = useState<number | null>(null);
  const [exitDir, setExitDir] = useState<ExitDir>("right");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isAnimatingRef = useRef(false);
  const { trigger, isTransitioning, overlayVisible } = usePathwayTransition();

  const goNext = useCallback(() => {
    if (isAnimatingRef.current || n < 2) return;
    isAnimatingRef.current = true;
    const current = activeIndexRef.current;
    setExitingIndex(current);
    setExitDir("right");
    const next = (current + 1) % n;
    activeIndexRef.current = next;
    setActiveIndex(next);
    setTimeout(() => {
      setExitingIndex(null);
      isAnimatingRef.current = false;
    }, 420);
  }, [n]);

  const goPrev = useCallback(() => {
    if (isAnimatingRef.current || n < 2) return;
    isAnimatingRef.current = true;
    const current = activeIndexRef.current;
    setExitingIndex(current);
    setExitDir("left");
    const prev = (current - 1 + n) % n;
    activeIndexRef.current = prev;
    setActiveIndex(prev);
    setTimeout(() => {
      setExitingIndex(null);
      isAnimatingRef.current = false;
    }, 420);
  }, [n]);

  const jumpTo = useCallback((index: number) => {
    if (isAnimatingRef.current || index === activeIndexRef.current) return;
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  function getSlotStyles(slotIndex: number): CSSProperties {
    if (slotIndex === exitingIndex) {
      return {
        gridArea: "1 / 1",
        zIndex: 30,
        transition: STACK_TRANSITION,
        transform:
          exitDir === "right"
            ? "translateX(110%) rotate(6deg)"
            : "translateX(-110%) rotate(-4deg)",
        opacity: 0,
        pointerEvents: "none",
      };
    }
    if (slotIndex === activeIndex) {
      return {
        gridArea: "1 / 1",
        zIndex: 30,
        transition: STACK_TRANSITION,
        transform: "translateY(0) scale(1)",
        opacity: 1,
        cursor: n > 1 ? "pointer" : "default",
      };
    }
    if (n >= 2 && slotIndex === (activeIndex + 1) % n) {
      return {
        gridArea: "1 / 1",
        zIndex: 20,
        transition: STACK_TRANSITION,
        transform: "translateY(8px) scale(0.96)",
        opacity: 0.6,
        pointerEvents: "none",
      };
    }
    return {
      gridArea: "1 / 1",
      zIndex: 10,
      transition: STACK_TRANSITION,
      transform: "translateY(16px) scale(0.92)",
      opacity: 0.35,
      pointerEvents: "none",
    };
  }

  const currentPathway = pathways[activeIndex];
  const isSelected = selectedId === currentPathway?.pathway_id;

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#6B6B6B",
              margin: "0 0 8px",
              fontFamily: "var(--pw-font-body)",
            }}
          >
            Your immigration pathways
          </p>
          <h2
            style={{
              fontFamily: "var(--pw-font-display)",
              fontSize: "1.75rem",
              color: "#0D0D0D",
              lineHeight: 1.1,
              margin: "0 0 4px",
              fontWeight: 400,
            }}
          >
            {n} route{n !== 1 ? "s" : ""} identified.
          </h2>
          <p
            style={{
              fontSize: 12,
              color: "#6B6B6B",
              margin: 0,
              fontFamily: "var(--pw-font-body)",
            }}
          >
            Ranked by match strength
          </p>
        </div>

        <button
          onClick={onReEvaluate}
          style={{
            background: "none",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 100,
            fontSize: 12,
            color: "#6B6B6B",
            padding: "6px 14px",
            cursor: "pointer",
            fontFamily: "var(--pw-font-body)",
            flexShrink: 0,
            transition: "border-color 150ms, color 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.3)";
            (e.currentTarget as HTMLButtonElement).style.color = "#0D0D0D";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.12)";
            (e.currentTarget as HTMLButtonElement).style.color = "#6B6B6B";
          }}
        >
          Re-evaluate ↻
        </button>
      </div>

      {/* Card stack — all slots share grid cell 1/1 */}
      <div
        style={{
          display: "grid",
          paddingBottom: 16,
          overflow: "visible",
        }}
      >
        {pathways.map((pathway, i) => (
          <div
            key={pathway.pathway_id}
            style={getSlotStyles(i)}
            onClick={i === activeIndex ? goNext : undefined}
            aria-label={
              i === activeIndex
                ? `${pathway.pathway_name} — tap to advance`
                : undefined
            }
          >
            <PathwayCardContent
              pathway={pathway}
              cardIndex={i}
              total={n}
              isActive={i === activeIndex}
            />
          </div>
        ))}
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 8,
        }}
      >
        {/* Dot navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pathways.map((_, i) => (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              aria-label={`Go to pathway ${i + 1}`}
              style={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: i === activeIndex ? 3 : "50%",
                background:
                  i === activeIndex ? "#0D0D0D" : "rgba(0,0,0,0.12)",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 200ms ease",
              }}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {n > 1 && (
            <button
              onClick={goPrev}
              style={{
                background: "#FFFFFF",
                color: "#6B6B6B",
                fontSize: 12,
                padding: "8px 16px",
                borderRadius: 100,
                border: "1px solid rgba(0,0,0,0.12)",
                cursor: "pointer",
                fontFamily: "var(--pw-font-body)",
                transition: "border-color 150ms, color 150ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(0,0,0,0.3)";
                (e.currentTarget as HTMLButtonElement).style.color = "#0D0D0D";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(0,0,0,0.12)";
                (e.currentTarget as HTMLButtonElement).style.color = "#6B6B6B";
              }}
            >
              ← Previous
            </button>
          )}

          <button
            onClick={() => {
              if (currentPathway) {
                setSelectedId(currentPathway.pathway_id);
                void trigger(currentPathway.pathway_id);
              }
            }}
            disabled={isTransitioning}
            style={{
              background: "#0D0D0D",
              color: "#FFFFFF",
              fontSize: 13,
              padding: "8px 20px",
              borderRadius: 100,
              border: "none",
              cursor: isTransitioning ? "not-allowed" : "pointer",
              fontWeight: 500,
              fontFamily: "var(--pw-font-body)",
              transition: "background 150ms, opacity 150ms",
              opacity: isTransitioning ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isTransitioning) (e.currentTarget as HTMLButtonElement).style.background = "#1A56DB";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#0D0D0D";
            }}
          >
            {isTransitioning ? "Saving…" : isSelected ? "✓ Pathway selected" : "Select this pathway"}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <hr
        style={{
          border: "none",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          margin: "20px 0 12px",
        }}
      />
      <p
        style={{
          fontSize: 11,
          color: "#9B9B9B",
          textAlign: "center",
          lineHeight: 1.5,
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        General information only — not legal advice. For your specific situation,
        consult a licensed immigration consultant or lawyer.
      </p>

      {/* White fade overlay rendered into document.body to avoid stacking-context clipping */}
      {isTransitioning && createPortal(
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "#FFFFFF",
            zIndex: 50,
            pointerEvents: "none",
            opacity: overlayVisible ? 1 : 0,
            transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />,
        document.body
      )}
    </div>
  );
}

// ─── NoResults ────────────────────────────────────────────────────────────────

function NoResults() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "80px 24px",
        gap: 16,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#6B6B6B",
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        No pathways found
      </p>
      <h2
        style={{
          fontFamily: "var(--pw-font-display)",
          fontSize: "1.5rem",
          fontWeight: 400,
          color: "#0D0D0D",
          margin: 0,
        }}
      >
        We couldn&apos;t match any routes.
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "#6B6B6B",
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 320,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        Your profile may need more detail to generate accurate matches.
      </p>
      <a
        href="/onboarding"
        style={{
          display: "inline-block",
          background: "#0D0D0D",
          color: "#FFFFFF",
          fontSize: 13,
          padding: "10px 24px",
          borderRadius: 100,
          textDecoration: "none",
          fontWeight: 500,
          fontFamily: "var(--pw-font-body)",
          marginTop: 8,
        }}
      >
        Update my profile →
      </a>
    </div>
  );
}

// ─── EmptyState (no cached analysis) ─────────────────────────────────────────

function EmptyState({ onFind }: { onFind: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "80px 24px",
        gap: 20,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#6B6B6B",
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        Your immigration pathways
      </p>
      <h2
        style={{
          fontFamily: "var(--pw-font-display)",
          fontSize: "1.5rem",
          fontWeight: 400,
          color: "#0D0D0D",
          margin: 0,
        }}
      >
        Find your routes.
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "#6B6B6B",
          lineHeight: 1.7,
          margin: 0,
          maxWidth: 320,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        We&apos;ll surface the programs you qualify for based on your profile.
      </p>
      <button
        onClick={onFind}
        style={{
          background: "#0D0D0D",
          color: "#FFFFFF",
          fontSize: 13,
          padding: "10px 28px",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
          fontFamily: "var(--pw-font-body)",
          marginTop: 4,
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#1A56DB";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#0D0D0D";
        }}
      >
        Analyse my profile →
      </button>
      <p
        style={{
          fontSize: 12,
          color: "#9B9B9B",
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        Takes 15–20 seconds
      </p>
    </div>
  );
}

// ─── ErrorState ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "80px 0",
        gap: 12,
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#6B6B6B",
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        Something went wrong
      </p>
      <p
        style={{
          fontSize: 14,
          color: "#0D0D0D",
          maxWidth: 320,
          lineHeight: 1.6,
          margin: 0,
          fontFamily: "var(--pw-font-body)",
        }}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#0D0D0D",
          color: "#FFFFFF",
          fontSize: 13,
          padding: "8px 20px",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
          fontFamily: "var(--pw-font-body)",
          alignSelf: "flex-start",
          marginTop: 4,
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#1A56DB";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#0D0D0D";
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Fetches and renders the top AI-matched immigration pathways for the current user. */
export function PathwayRecommendations() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [result, setResult] = useState<PathwayMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [resultsKey, setResultsKey] = useState(0);

  // On mount: GET for cached result; no automatic POST
  useEffect(() => {
    let cancelled = false;

    async function checkCache() {
      try {
        const res = await fetch("/api/pathways/match", { method: "GET" });
        if (!cancelled) {
          if (res.ok) {
            const json = (await res.json()) as { data: PathwayMatchResult | null };
            if (json.data) {
              setResult(json.data);
              setViewState("results");
            } else {
              setViewState("empty");
            }
          } else {
            setViewState("empty");
          }
        }
      } catch {
        if (!cancelled) setViewState("empty");
      }
    }

    void checkCache();
    return () => {
      cancelled = true;
    };
  }, []);

  // Advance step indicators while analyzing
  useEffect(() => {
    if (viewState !== "analyzing") return;
    setCompletedSteps(new Set());

    const timers = ANALYZING_STEPS.map((step, i) =>
      isFinite(step.completedAfterMs)
        ? setTimeout(
            () => setCompletedSteps((prev) => new Set([...prev, i])),
            step.completedAfterMs
          )
        : null
    ).filter((t): t is ReturnType<typeof setTimeout> => t !== null);

    return () => timers.forEach(clearTimeout);
  }, [viewState]);

  const runMatch = useCallback(async () => {
    setViewState("analyzing");
    setError(null);

    try {
      const res = await fetch("/api/pathways/match", { method: "POST" });
      const json = (await res.json()) as
        | { data: PathwayMatchResult }
        | { error: { code: string; message: string } };

      if ("error" in json) {
        setError(json.error.message);
        setViewState("error");
        return;
      }

      setResult(json.data);
      setResultsKey((k) => k + 1);
      setViewState("results");
    } catch {
      setError("Something went wrong. Please try again.");
      setViewState("error");
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative" }}>
      {/* Dot-grid texture layer */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, #1A1A1A 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.07,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Content sits above texture */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {viewState === "loading" && <LoadingStack />}

        {viewState === "empty" && (
          <EmptyState onFind={() => void runMatch()} />
        )}

        {viewState === "analyzing" && (
          <AnalyzingState completedSteps={completedSteps} />
        )}

        {viewState === "error" && (
          <ErrorState
            message={error ?? "Something went wrong. Please try again."}
            onRetry={() => void runMatch()}
          />
        )}

        {viewState === "results" && result && (
          <>
            {result.top_pathways.length === 0 ? (
              <NoResults />
            ) : (
              <CardStack
                key={resultsKey}
                pathways={result.top_pathways}
                onReEvaluate={() => void runMatch()}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
