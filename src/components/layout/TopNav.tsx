"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Pathway", href: "/pathway" },
  { label: "Documents", href: "/documents" },
  { label: "Profile", href: "/profile" },
] as const;

/** Sticky top navigation bar shared across all authenticated app pages. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      className="topnav sticky top-0 z-50 h-14 flex items-center justify-between px-6 md:px-10"
      aria-label="Main navigation"
    >
      {/* Wordmark */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-jakarta text-lg font-medium text-pine flex-shrink-0"
      >
        <span className="pine-btn w-5 h-5 rounded-full flex-shrink-0" aria-hidden="true" />
        Pathways
        <span aria-hidden="true">.</span>
      </Link>

      {/* Center nav pills */}
      <div
        className="hidden md:flex items-center gap-1 bg-white/55 rounded-full px-1.5 py-1 border border-white/70"
        role="tablist"
      >
        {NAV_LINKS.map(({ label, href }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              role="tab"
              aria-selected={isActive}
              className={
                isActive
                  ? "pine-btn gap-0 px-3.5 py-1.5 rounded-full font-dm-sans text-sm"
                  : "px-3.5 py-1.5 rounded-full font-dm-sans text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right — search + lang toggle + bell */}
      <div className="flex items-center gap-2.5">
        {/* Search */}
        <div className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-full bg-white/60 border border-white/70">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-neutral-400 flex-shrink-0"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="font-dm-sans text-xs text-neutral-400">Search…</span>
        </div>

        {/* Language toggle */}
        <div
          className="flex items-center p-1 gap-0.5 rounded-full bg-white/50 border border-white/70"
          role="group"
          aria-label="Language"
        >
          <span className="pine-btn gap-0 w-9 h-7 rounded-full font-dm-sans text-xs font-medium justify-center cursor-default">
            EN
          </span>
          <span className="w-9 h-7 rounded-full font-dm-sans text-xs font-medium text-neutral-400 flex items-center justify-center cursor-default">
            FR
          </span>
        </div>

        {/* Notifications bell */}
        <button
          aria-label="Notifications"
          className="w-9 h-9 rounded-full bg-white border border-black/5 flex items-center justify-center text-neutral-800 hover:bg-neutral-50 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
