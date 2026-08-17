"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { X, Check } from "lucide-react";

export interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Feature that triggered the paywall — shown in headline. */
  featureName?: string;
}

const PRO_FEATURES = [
  "Unlimited pathway comparisons",
  "AI document analysis and feedback",
  "Priority email support",
  "Step-by-step application guidance",
  "Early access to new pathways",
];

async function startCheckout(): Promise<void> {
  const res = await fetch('/api/stripe/checkout', { method: 'POST' });
  if (res.status === 401) {
    window.location.href = '/auth/login';
    return;
  }
  const json = await res.json() as { url?: string; error?: { code: string; message: string } };
  if (json.url) {
    window.location.href = json.url;
  }
}

/** Full-screen upgrade modal with dark forest green overlay and topographic texture. */
export function UpgradeModal({ open, onClose, featureName }: UpgradeModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleUpgrade = () => {
    setCheckoutError(null);
    startTransition(async () => {
      try {
        await startCheckout();
      } catch {
        setCheckoutError('Something went wrong. Please try again.');
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Pro"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(13,74,58,0.95)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Topographic texture */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/textures/topo-lines.svg')",
          backgroundRepeat: "repeat",
          backgroundSize: "600px 600px",
          opacity: 0.06,
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 9999,
            border: "none",
            background: "rgba(0,0,0,0.06)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={15} color="rgba(0,0,0,0.5)" />
        </button>

        {/* Eyebrow */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#0D4A3A",
            fontFamily: "var(--pw-font-body)",
            marginBottom: 10,
          }}
        >
          Pro feature
        </p>

        {/* Headline */}
        <h2
          style={{
            fontFamily: "var(--pw-font-display)",
            fontSize: "clamp(1.4rem, 3vw, 1.9rem)",
            fontWeight: 400,
            color: "#0D0D0D",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: 10,
          }}
        >
          {featureName
            ? `Unlock ${featureName}`
            : "Upgrade to Pathways Pro"}
        </h2>

        <p style={{ fontSize: 14, color: "#6B6B6B", fontFamily: "var(--pw-font-body)", lineHeight: 1.6, marginBottom: 24 }}>
          Get full access to every tool we offer to navigate your Canadian immigration journey.
        </p>

        {/* Feature list */}
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 10 }}>
          {PRO_FEATURES.map((feat) => (
            <li
              key={feat}
              style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontFamily: "var(--pw-font-body)", color: "#0D0D0D" }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 9999,
                  backgroundColor: "rgba(13,74,58,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check size={11} color="#0D4A3A" strokeWidth={2.5} />
              </span>
              {feat}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={isPending}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "13px 24px",
            borderRadius: 9999,
            backgroundColor: isPending ? "rgba(13,74,58,0.55)" : "#0D4A3A",
            color: "#fff",
            fontSize: 15,
            fontWeight: 500,
            fontFamily: "var(--pw-font-body)",
            border: "none",
            cursor: isPending ? "default" : "pointer",
          }}
        >
          {isPending ? "Redirecting…" : "Upgrade to Pro — $99/year"}
        </button>

        {checkoutError && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#D0000C", fontFamily: "var(--pw-font-body)", marginTop: 10 }}>
            {checkoutError}
          </p>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#9D9D9D", fontFamily: "var(--pw-font-body)", marginTop: 14 }}>
          Cancel anytime. No hidden fees.
        </p>
      </div>
    </div>
  );
}

type UsePaywallResult = {
  open: boolean;
  featureName: string | undefined;
  show: (featureName?: string) => void;
  hide: () => void;
};

/** Hook that manages paywall modal visibility. Pair with <UpgradeModal />. */
export function usePaywall(): UsePaywallResult {
  const [open, setOpen] = useState(false);
  const [featureName, setFeatureName] = useState<string | undefined>(undefined);

  const show = useCallback((name?: string) => {
    setFeatureName(name);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  return { open, featureName, show, hide };
}
