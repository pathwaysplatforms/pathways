"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import "./VoiceProfilePanel.css";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import { computeCrsEstimate } from "@/lib/crs-estimate";
import { resolveDisplayFields, GROUP_ORDER } from "@/lib/profile-field-display";
import type { FieldGroup } from "@/lib/profile-field-display";

interface VoiceProfilePanelProps {
  profile: Partial<VoiceExtractedProfile>;
}

function crsBarColor(score: number): string {
  if (score < 400) return "#D85A30";
  if (score < 470) return "#BA7517";
  if (score < 540) return "#534AB7";
  return "#0F6E56";
}

const GROUP_LABELS: Record<FieldGroup, string> = {
  basics: "Basics",
  work: "Work",
  language: "Language",
  education: "Education",
  extras: "Extras",
};

/** Right-side profile panel: live CRS estimate and up to 20 extracted fields. */
export function VoiceProfilePanel({ profile }: VoiceProfilePanelProps) {
  const estimate = computeCrsEstimate(profile);
  const visibleFields = resolveDisplayFields(profile);

  // CRS score counter animation
  const [displayScore, setDisplayScore] = useState(0);
  const prevScoreRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!estimate) return;
    const target = estimate.score;
    const start = prevScoreRef.current;
    if (start === target) return;
    const duration = 600;
    const startTime = performance.now();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(start + (target - start) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevScoreRef.current = target;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [estimate?.score]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll fade state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop <= el.clientHeight + 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, visibleFields.length]);

  // Stable field index for deterministic animation delay (never re-animates existing elements)
  const FIELD_KEYS = GROUP_ORDER.flatMap((group) =>
    visibleFields.filter((f) => f.group === group).map((f) => f.key)
  );

  const visibleGroups = GROUP_ORDER.filter((group) =>
    visibleFields.some((f) => f.group === group)
  );

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid var(--voice-border, rgba(0,0,0,0.07))",
        borderRadius: 16,
        padding: 20,
        minHeight: 340,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: "calc(100vh - 80px)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "Urbanist, sans-serif",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: "var(--voice-text-muted, #8B8BA0)",
          }}
        >
          Your Profile
        </span>
        {visibleFields.length > 0 && (
          <span
            style={{
              fontSize: 11,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
            }}
          >
            {visibleFields.length}/21 fields
          </span>
        )}
      </div>

      {/* CRS estimate section */}
      {estimate && (
        <div
          style={{
            background: "rgba(26,86,219,0.04)",
            border: "1px solid rgba(26,86,219,0.12)",
            borderRadius: 10,
            padding: "12px 14px",
            flexShrink: 0,
            animation: "voice-crs-enter 400ms ease-out both",
          }}
        >
          {/* Provincial nomination callout */}
          {profile.has_provincial_nomination === true && (
            <div
              style={{
                background: "rgba(15,110,86,0.08)",
                border: "1px solid rgba(15,110,86,0.2)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                color: "#0F6E56",
                fontFamily: "Urbanist, sans-serif",
                marginBottom: 10,
                lineHeight: 1.4,
              }}
            >
              🏅 Provincial nomination: +600 pts — Express Entry guarantee
            </div>
          )}

          {/* Title row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--voice-text-muted, #8B8BA0)",
                fontFamily: "Urbanist, sans-serif",
                letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}
            >
              CRS Estimate
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: crsBarColor(estimate.score),
                fontFamily: "Urbanist, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              {displayScore}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 6,
              background: "rgba(26,86,219,0.10)",
              borderRadius: 3,
              overflow: "hidden",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(estimate.score / 1200) * 100}%`,
                background: crsBarColor(estimate.score),
                borderRadius: 3,
                transition: "width 600ms ease-out, background-color 600ms ease",
              }}
            />
          </div>

          {/* Range */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
              marginBottom: estimate.belowCutoff ? 8 : 0,
            }}
          >
            <span>{estimate.low}</span>
            <span style={{ opacity: 0.5 }}>±{estimate.margin} margin</span>
            <span>{estimate.high}</span>
          </div>

          {/* Below-cutoff warning */}
          {estimate.belowCutoff && estimate.cutoffReason && (
            <div
              style={{
                fontSize: 11,
                color: "#BA7517",
                fontFamily: "Urbanist, sans-serif",
                lineHeight: 1.4,
              }}
            >
              ⚠ {estimate.cutoffReason}
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {visibleFields.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              height: 2,
              background: "var(--voice-border, rgba(0,0,0,0.07))",
              borderRadius: 1,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round((visibleFields.length / 21) * 100)}%`,
                background: "var(--pw-accent)",
                borderRadius: 1,
                transition: "width 500ms ease-out",
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {visibleFields.length === 0 && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: 0.4,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: "1.5px dashed var(--voice-text-muted, #8B8BA0)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--voice-text-muted, #8B8BA0)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 4v8M4 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--voice-text-muted, #8B8BA0)",
              fontFamily: "Urbanist, sans-serif",
            }}
          >
            Fields appear as you speak
          </p>
        </div>
      )}

      {/* Field list — scrollable with bottom fade */}
      {visibleFields.length > 0 && (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto" as const,
            maskImage: atBottom
              ? undefined
              : "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)",
            WebkitMaskImage: atBottom
              ? undefined
              : "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)",
          }}
        >
          {visibleGroups.map((group, groupIdx) => {
            const groupFields = visibleFields.filter((f) => f.group === group);
            return (
              <div key={group}>
                {groupIdx > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: "var(--voice-border, rgba(0,0,0,0.07))",
                      margin: "4px 0",
                    }}
                  />
                )}
                {groupFields.map((field) => {
                  const stableIdx = FIELD_KEYS.indexOf(field.key);
                  const delayMs = Math.max(0, stableIdx) * 35;
                  return (
                    <div
                      key={field.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        padding: "7px 0",
                        borderBottom: "1px solid var(--voice-border, rgba(0,0,0,0.07))",
                        animation: "voice-field-enter 350ms ease-out both",
                        animationDelay: `${delayMs}ms`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--voice-text-muted, #8B8BA0)",
                          fontFamily: "Urbanist, sans-serif",
                          flexShrink: 0,
                          marginRight: 8,
                        }}
                      >
                        {field.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--voice-text, #1A1A2E)",
                          fontFamily: "Urbanist, sans-serif",
                          textAlign: "right" as const,
                          wordBreak: "break-word" as const,
                        }}
                      >
                        {field.formatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
