# Pathways — design system specification

## Philosophy
Immigration is high-stakes. Users are often anxious and uncertain.
The UI must feel calm, authoritative, and clear. Think Stripe or Linear.
Every design decision should reduce cognitive load, not add visual interest.

## Stack
- Tailwind CSS v4
- shadcn/ui (slate base — components copied into /src/components/ui/)
- Radix UI (via shadcn)
- Framer Motion (purposeful transitions only)
- Lucide React (icons)
- Lottie React (voice waveform only)
- Inter font via next/font/google

## Colour tokens
Define in app/globals.css as CSS variables:

--color-brand: #2563EB
--color-brand-dark: #1D4ED8
--color-brand-light: #EFF6FF
--color-neutral-50: #F8FAFC
--color-neutral-100: #F1F5F9
--color-neutral-200: #E2E8F0
--color-neutral-400: #94A3B8
--color-neutral-600: #475569
--color-neutral-800: #1E293B
--color-neutral-900: #0F172A
--color-success: #16A34A
--color-success-bg: #F0FDF4
--color-warning: #D97706
--color-warning-bg: #FFFBEB
--color-danger: #DC2626
--color-danger-bg: #FEF2F2

Dark mode under .dark class. darkMode: 'class' in tailwind config.

## Typography
Font: Inter (weights 400 and 500 only — never 600 or 700)

Scale:
- text-[28px] font-medium  → page headings h1
- text-xl font-medium      → section headings h2
- text-base font-medium    → card titles h3
- text-sm                  → body text (default)
- text-[13px] text-neutral-600 → secondary text
- text-[11px] font-medium uppercase tracking-wide text-neutral-400 → labels

Line height: leading-relaxed on all body text.

## Spacing
Base unit: 4px (Tailwind default). Use Tailwind spacing scale only.
Standard card padding: p-5
Standard section gap: gap-6
Never use arbitrary spacing values.

## Border radius
rounded      → 6px  small elements
rounded-md   → 8px  inputs, buttons, cards
rounded-xl   → 12px modals, large cards
rounded-full → pill for status badges ONLY

## Shadows
Almost none. Use borders instead.
Exception: modals use shadow-lg.
Cards: border border-neutral-200 only, no shadow.

## Component rules

### Buttons
Four variants only: primary, secondary, ghost, danger.
Primary: bg-brand text-white — one maximum per screen.
Secondary: border border-neutral-200
Ghost: text-brand no border
Danger: bg-danger-bg text-danger border border-red-200
All: rounded-md h-10 px-4 text-sm font-medium

### Cards
bg-white border border-neutral-200 rounded-xl p-5
No shadow. Hover: border-neutral-300 transition.

### Status badges
rounded-full, four states only:
- complete: bg-success-bg text-success
- in_progress: bg-warning-bg text-warning
- action_needed: bg-danger-bg text-danger
- not_started: bg-neutral-100 text-neutral-600
Text: text-xs font-medium. Padding: px-2.5 py-0.5

### Form inputs
h-10 border border-neutral-200 rounded-md px-3 text-sm
Focus: ring-2 ring-brand border-brand
Error: border-danger ring-danger
Always include visible label above — never placeholder-only.

### Page layout
Single-column flows: max-w-3xl centred
Dashboard views: max-w-6xl
Sidebar: 240px fixed

### Loading states
Skeleton loaders (neutral-100 animated pulse). No spinners except
for sub-second operations.

### Empty states
Every list must have an empty state:
- Lucide icon (neutral-300, size 40)
- Neutral heading
- Single CTA if action available

### Errors
Inline: text-danger text-[13px] mt-1 below the input
Page-level: amber banner at top of form
Never use alert() or browser dialogs.

## What Claude Code must NOT do
- Use arbitrary Tailwind values
- Use inline styles where Tailwind can achieve it
- Use colours outside the token set
- Use font-weight 600 or 700
- Use box shadows on cards
- Place more than one primary button per screen
- Use placeholder-only form fields
- Use lorem ipsum copy

## Responsive
Mobile-first. All layouts work at 375px.
Sidebar collapses to bottom nav on mobile.
Voice interface goes full-screen on mobile.
Cards stack single column below md breakpoint.