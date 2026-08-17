"use client";

import { useState, useTransition } from "react";
import type { SubscriptionStatus } from "@/modules/account/types";

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

interface Props {
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}

const TIER_LABELS: Record<SubscriptionStatus, string> = {
  guest: "Guest",
  free: "Free",
  paid: "Pro",
};

const TIER_DESCRIPTIONS: Record<SubscriptionStatus, string> = {
  guest: "Limited access. Sign in to unlock your full immigration profile.",
  free: "Access to pathway matching, dashboard, and basic application tracking.",
  paid: "Full access to all features including document analysis, priority support, and unlimited pathways.",
};

/** Section C: subscription tier display with upgrade prompt. */
export function AccountSubscriptionSection({ subscriptionStatus, createdAt }: Props) {
  const memberSince = new Date(createdAt).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
  });

  const isPaid = subscriptionStatus === "paid";
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

  return (
    <section className="card" style={{ padding: 24 }}>
      <h2
        style={{
          fontFamily: "var(--pw-font-body)",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--pw-ink)",
          marginBottom: 20,
        }}
      >
        Account &amp; Subscription
      </h2>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: "var(--pw-font-body)",
                backgroundColor: isPaid ? "var(--pw-accent)" : "var(--pw-ink)",
                color: "#fff",
              }}
            >
              {TIER_LABELS[subscriptionStatus]}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)", lineHeight: 1.6, maxWidth: "40ch" }}>
            {TIER_DESCRIPTIONS[subscriptionStatus]}
          </p>
          <p style={{ fontSize: 12, color: "var(--pw-muted)", fontFamily: "var(--pw-font-body)", marginTop: 8 }}>
            Member since {memberSince}
          </p>
        </div>

        {!isPaid && (
          <div style={{ flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "9px 20px",
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "var(--pw-font-body)",
                backgroundColor: isPending ? "rgba(0,0,0,0.35)" : "var(--pw-ink)",
                color: "#fff",
                border: "none",
                cursor: isPending ? "default" : "pointer",
              }}
            >
              {isPending ? "Redirecting…" : "Upgrade to Pro →"}
            </button>
            {checkoutError && (
              <p style={{ fontSize: 12, color: "#D0000C", fontFamily: "var(--pw-font-body)", marginTop: 6 }}>
                {checkoutError}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
