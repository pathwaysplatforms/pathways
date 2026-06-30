"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ChevronRight } from "lucide-react";
import type { PathwayMatchResult, PathwayRecommendation } from "@/types/pathways";
import { SaveResultsModal } from "./SaveResultsModal";

interface Props {
  token: string;
  results: PathwayMatchResult;
  expiresAt: string;
}

/** Format a date string as "results expire on Month D, YYYY". */
function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

/** Label → background/text colours for the match badge. */
function matchBadgeClass(label: string): string {
  if (label === "Excellent match") return "bg-status-success-bg text-status-success-text";
  if (label === "Good match") return "bg-accent-50 text-accent-700";
  return "bg-bg-subtle text-text-secondary";
}

function PathwayCard({ pw, rank }: { pw: PathwayRecommendation; rank: number }) {
  return (
    <div className="card p-6">
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: rank === 1 ? "var(--color-accent-500)" : "var(--color-text-tertiary)" }}
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-lg">{pw.flag_emoji}</span>
            <h2 className="font-bold text-text-primary text-base">{pw.pathway_name}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium ${matchBadgeClass(pw.match_label)}`}>
              {pw.match_label}
            </span>
          </div>

          <p className="text-text-secondary text-sm mb-3">{pw.why_it_fits}</p>

          <div className="flex items-center gap-1.5 mb-3 text-text-tertiary text-xs">
            <Clock size={12} />
            <span>{pw.estimated_timeline}</span>
          </div>

          <ul className="space-y-1.5 mb-4">
            {pw.key_requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-accent-500" />
                {req}
              </li>
            ))}
          </ul>

          {pw.gap_analysis && (
            <div className="p-3 rounded-card bg-bg-subtle border border-border-light mb-4">
              <p className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">Gap: </span>
                {pw.gap_analysis}
              </p>
            </div>
          )}

          {pw.source_url && (
            <a
              href={pw.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 transition-colors"
            >
              Official source <ChevronRight size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Full pathway results view with delayed signup modal. */
export function PathwayResultsView({ token, results, expiresAt }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setModalOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const expiry = formatExpiry(expiresAt);

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="bg-bg-surface border-b border-border-light sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-bold tracking-tight text-text-primary">Pathways</Link>
            <a
              href={process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3001"}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors hidden sm:block"
              style={{ textDecoration: "none" }}
            >
              ← Back to pathways.app
            </a>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary px-4 py-2 text-sm"
          >
            Save my results
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Intro */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Your immigration pathways</h1>
          <p className="text-text-secondary text-sm">{results.summary}</p>
          {expiry && (
            <p className="mt-3 text-xs text-text-tertiary">
              Results expire on {expiry} without an account.{" "}
              <button onClick={() => setModalOpen(true)} className="underline underline-offset-2 text-accent-600 hover:text-accent-700">
                Save them now
              </button>
              {" "}— it only takes a minute.
            </p>
          )}
        </div>

        {/* Pathway cards */}
        <div className="space-y-5">
          {results.top_pathways.map((pw, i) => (
            <PathwayCard key={pw.pathway_id} pw={pw} rank={i + 1} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-text-secondary text-sm mb-3">
            Create a free account to track your progress, upload documents, and get step-by-step guidance.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary px-8 py-3"
          >
            Save my results →
          </button>
        </div>
      </div>

      {modalOpen && (
        <SaveResultsModal
          guestToken={token}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
