"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  /** Override destination instead of router.back() */
  href?: string;
  label?: string;
}

/** Minimal back arrow for standalone pages that have no top nav. */
export function BackButton({ href, label = "Back" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => (href ? router.push(href) : router.back())}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--pw-font-body)",
        fontSize: 13,
        fontWeight: 500,
        color: "var(--pw-muted)",
        background: "none",
        border: "none",
        padding: "4px 0",
        cursor: "pointer",
        transition: "color 0.15s ease",
        marginBottom: 28,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--pw-ink)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--pw-muted)";
      }}
    >
      <ArrowLeft size={15} strokeWidth={2} />
      {label}
    </button>
  );
}
