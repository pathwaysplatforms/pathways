# Pathways Dashboard Redesign Spec
## For Claude Code — Layout & Content Refactor

---

## What This Spec Changes (and What It Does NOT Change)

**CHANGES:**
- Dashboard shell: sidebar → top navigation bar
- Dashboard card layout: 3-column grid → 2-column bento layout
- Card contents for all four dashboard states

**DOES NOT CHANGE:**
- Color palette — keep all existing Tailwind tokens, CSS variables, and DESIGN_SPEC.md colors exactly as-is
- Typography — Urbanist is already in use, keep it
- Design tokens in `tailwind.config.ts` and `globals.css` — do not touch these files
- State derivation logic in `useDashboardState.ts`
- Data fetching in `getDashboardData.ts`
- Accent color, card shadows, border radii, spacing tokens — all stay the same

The only visual changes are **layout structure** and **card content per state**.

---

## 1. Shell Change — Sidebar → Top Nav

### Remove
- The left sidebar from `DashboardShell.tsx`
- Any sidebar-related layout wrappers or CSS

### Replace with Top Nav Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP NAV (height: 48px, bg: same as page background, no border) │
│  [Pathways.]  [Dashboard] [Application] [Documents] [Profile]   │
│                                                    [Name] [AM]  │
├── 0.5px divider (border-light color from design tokens) ────────┤
│  MAIN CONTENT AREA (flex: 1, overflow: hidden)                  │
│  padding: 0 28px 28px                                           │
└─────────────────────────────────────────────────────────────────┘
```

**Top nav details:**
- Background: same as page (`bg-base` from design tokens) — nav floats seamlessly, no container
- Logo: `"Pathways."` wordmark using existing logo treatment from sidebar
- Nav links: pill-shaped buttons with icon + label. Use existing active/inactive styles from sidebar nav — just rendered horizontally instead of vertically
- Right: user full name + candidate ID (small, `text-tertiary`) + avatar. Use existing avatar component.
- The `0.5px` divider uses `border-light` from existing design tokens

**Nav links** (lucide-react icons, same as sidebar):
- Dashboard → `LayoutDashboard`
- Application → `Route`
- Documents → `Files`
- Profile → `User`

Create `src/components/dashboard/TopNav.tsx` for the new nav component.

---

## 2. Main Content Layout — 2-Column Grid

Replace the existing 3-column card grid with this layout for **all four states**:

```
┌──────────────────────────────────────────┬──────────────┐
│  LEFT COLUMN (flex: 1)                    │  RIGHT COL   │
│                                           │  (220px,     │
│  [Greeting — "Good morning, Aarav."]      │  full height │
│                                           │  of content  │
│  ┌───────────────┐  ┌───────────────┐     │  area)       │
│  │   Card A      │  │   Card B      │     │              │
│  │  (155px tall) │  │  (155px tall) │     │  MyPathway   │
│  └───────────────┘  └───────────────┘     │  Card        │
│                                           │              │
│  ┌────────────────────────────────────┐   │              │
│  │  Map Card (flex: 1, fills rest)    │   │              │
│  └────────────────────────────────────┘   │              │
└──────────────────────────────────────────┴──────────────┘
```

**Layout rules (use existing spacing tokens):**
- Outer wrapper: `display: flex, gap: gap-[14px], padding: 0 p-7 p-7, overflow: hidden, flex: 1, min-height: 0`
- Left column: `display: flex, flex-direction: column, gap: gap-[14px], flex: 1, min-height: 0`
- Top card row: `display: grid, grid-template-columns: 1fr 1fr, gap: gap-[14px], height: 155px, flex-shrink: 0`
- Map card: `flex: 1, min-height: 0, rounded-card (16px), overflow: hidden, position: relative` — no background, SVG fills 100%
- Right column (MyPathway card): `width: 220px, flex-shrink: 0` — starts at same vertical level as cards (below greeting)

---

## 3. Greeting Header

Sits above Card A / Card B in the left column. Not inside any card.

```tsx
<div className="flex-shrink-0">
  <p className="text-[10px] font-semibold text-tertiary uppercase tracking-widest mb-1">
    {formattedDate}  {/* e.g. "Wednesday, May 21" */}
  </p>
  <h1 className="text-[20px] font-extrabold text-primary tracking-tight leading-tight">
    Good morning, <span className="text-accent-500">{firstName}.</span>
  </h1>
</div>
```

Use existing `text-tertiary`, `text-primary`, `text-accent-500` tokens.

---

## 4. Map Card (always present, identical across all states)

Full-bleed SVG world map. **Never changes. No background color on the container.**

**Container:** `rounded-card overflow-hidden position-relative flex-1 min-h-0`

**SVG spec:**
- `position: absolute, top: 0, left: 0, width: 100%, height: 100%`
- `viewBox="60 60 340 180"` `preserveAspectRatio="xMidYMid slice"`
- Background: radial gradient ocean fill from `#d0d0ee` center to `#a8a8d4` edge
- Grid lines: thin horizontal + vertical + ellipses in `rgba(255,255,255,0.2–0.45)`
- Continent fills: `rgba(255,255,255,0.52)` approximate shapes
- Dashed flight arc from Mumbai `(375,152)` to Toronto `(128,112)` using cubic bezier `Q280,48`
  - `stroke: accent-500 color, stroke-width: 2, stroke-dasharray: 5 4, opacity: 0.9`
- Mumbai origin: filled circle `r=5` in accent color + outer ring `r=10, opacity: 0.35`
- Toronto destination pin: filled circle `r=6` + outer ring + vertical line `x1=128 y1=118 x2=128 y2=136` + filled downward triangle

**Overlay labels (absolutely positioned, no card bg):**
- Bottom-left: `"{origin city} → {destination city}"` in `font-weight: 800, text-primary` + `"Immigration destination"` in `text-tertiary` below
- Bottom-right: frosted glass pill (`bg: rgba(255,255,255,0.82), backdrop-filter: blur(8px), rounded-lg, border: border-light`) showing flag emoji + country name + estimated date
- City name labels floating near each pin in `font-size: 7px, color: rgba(0,0,80,0.6)`

The origin city, destination, and estimated date come from user profile data. Default to Mumbai → Toronto if not set.

**Do not use any external map library. Inline SVG only.**

---

## 5. My Pathway Card (right column, always present)

Same card structure across all states. Content varies.

**Structure:**
```
┌──────────────────────────────┐
│  HEADER (uses card-accent    │  ← existing accent card header treatment
│  or a subtle tinted bg)      │    from design system
│  "MY PATHWAY" eyebrow        │
│  Pathway name    CRS: 482    │
│  Subtitle        Top 15%     │
├──────────────────────────────┤
│  CHECKLIST (white, flex:1)   │
│                              │
│  ●── Step 1                  │
│  │                           │
│  ●── Step 2 (active)         │
│  │   [CTA Button]            │
│  │                           │
│  ●── Step 3                  │
│  │                           │
│  ●── Step 4                  │
│  │                           │
│  ●── Step 5                  │
└──────────────────────────────┘
```

**Header:** Use the existing accent card header styling from DESIGN_SPEC.md. Keep existing color tokens.
- Eyebrow: `"MY PATHWAY"` — `text-tertiary, uppercase, tracking-wide, text-[7.5px]`
- Pathway name: `font-extrabold, text-primary, text-[17px]`
- Subtitle: `font-medium, text-accent-600, italic, text-[11px]`
- CRS eyebrow: same as above on the right side
- CRS number: `font-light, text-primary, text-[26px], tracking-tight`
- Pool rank: small status dot + label using existing `status.inProgress` token colors

**Checklist body:** white background, `padding: p-[14px] p-[18px]`, `flex: 1, flex-direction: column, min-height: 0, overflow: hidden`

Step nodes (18×18px circles):
- Done: `bg-accent-600, border-accent-600, text-white` — checkmark icon
- Active: `bg-accent-50, border-accent-500, text-accent-600` — step number
- Locked: `border-border-light, text-tertiary` — step number

Connector lines: `width: 1.5px, bg-border-light, flex: 1, margin: 3px auto` (inside a flex column between nodes)

Each step row: `flex: 1`. Active step: `flex: 2` (more space for the CTA button).

**Active step CTA button:** Use `btn-primary` (accent with sheen) from DESIGN_SPEC.md.

Step label colors:
- Completed: `text-tertiary`
- Active: `text-primary, font-extrabold`
- Upcoming: `text-secondary`
- Step subtitles: `text-tertiary, text-[8px]`

---

## 6. Four States — Card A, Card B, and My Pathway Card Content

The **card shells** (rounded white card, same shadow, same padding) are identical across states. Only the content inside changes.

---

### State 1 — Onboarding Incomplete

**Card A — Onboarding Progress (accent/shiny card):**
- Use the accent card treatment from DESIGN_SPEC.md (dark aquamarine bg + sheen)
- Eyebrow: `"ONBOARDING PROGRESS"` in `rgba(255,255,255,0.6)`
- Large percentage: e.g. `"68%"` — the user's profile completeness pct from `profile.profile_completeness_pct`
- Progress bar: white track + white fill at completeness pct, `height: 2.5px`
- Subtitle: `"X fields still needed"` derived from `profile.incomplete_fields.length`
- CTA button (ghost white): `"Complete profile →"` → `/onboarding/review`

**Card B — Getting Started (white card):**
- Title: `"Getting Started"`, `font-bold, text-primary, text-[12px]`
- List of 2–4 missing fields from `profile.incomplete_fields`, rendered as plain-English task rows:
  - Each: small circle node (outline = incomplete, filled accent = complete) + label
  - Map raw field names to readable labels: `language_scores` → "Language test scores", `work_experience` → "Work experience", `education` → "Education history", etc.
- CTA link at bottom: `"Finish your profile →"` in `text-accent-600, font-bold, text-[8.5px]`

**My Pathway Card — State 1 content:**
- Header eyebrow: `"MY PATHWAY"` | CRS eyebrow: `"CRS SCORE"`
- Title: `"Pathway Pending"` | CRS: `"—"` (em dash, not calculated yet)
- Subtitle: `"Complete your profile to unlock"` | Pool rank: `"Not yet calculated"` in `text-tertiary`
- Checklist (5 steps, step 1 active):
  1. ● Complete profile ← **active**, CTA: `"Finish profile →"` btn-primary → `/onboarding/review`
  2. ○ Receive pathway match
  3. ○ Select your pathway
  4. ○ Begin application
  5. ○ Submit application

---

### State 2 — Pathway Not Selected

**Card A — CRS Score (white card):**
- Title eyebrow: `"CRS SCORE"` in `text-tertiary`
- Large CRS number: e.g. `"482"` from `pathwayMatch.crs_score` — `font-light, text-primary, text-[36px], tracking-tight`
- `/1200` suffix in `text-tertiary`
- Pool rank status row: dot + label using `status.inProgress` colors
- Thin divider, then two small stat rows:
  - `"Next draw est."` + date (from pathway engine data if available, else `"—"`)
  - `"Profile"` + `"Complete ✓"` in `status.submitted` colors

**Card B — Top Pathway Matches (white card):**
- Title: `"Recommended"` `font-bold, text-primary, text-[12px]` + `"See all"` pill link in `text-accent-600, bg-accent-50`
- 2–3 pathway rows from `pathwayMatch.result.recommendations`:
  - Each row: pathway name (bold, 9.5px) + eligibility score badge in `bg-accent-50, text-accent-600` + `›` chevron
  - `border-b border-border-light` between rows
- Footer CTA: `"Choose your pathway →"` in `text-accent-600, font-bold, text-[8.5px]` → `/pathways`

**My Pathway Card — State 2 content:**
- Header: Title `"Not Selected Yet"` | CRS: show actual score `"482"`
- Subtitle: `"Choose a pathway to begin"` | Pool rank: `"Top X% of pool"` in `status.inProgress` colors
- Checklist (4 steps, step 2 active):
  1. ✓ Profile complete ← done
  2. ● Select a pathway ← **active**, CTA: `"Browse pathways →"` btn-primary → `/pathways`
  3. ○ Build your checklist
  4. ○ Submit application
  5. ○ Receive decision

---

### State 3 — Application In Progress (PRIMARY STATE)

This is the main state and should match the reference UI design most closely.

**Card A — Application Progress (accent/shiny card):**
- Use the accent card treatment (dark aquamarine + sheen) from DESIGN_SPEC.md
- Eyebrow: `"APPLICATION PROGRESS"` in `rgba(255,255,255,0.6)`
- Large progress pct: e.g. `"62%"` from `application.completedSteps / application.totalSteps * 100`
- Progress bar: white track + fill at pct, `height: 2.5px`
- Subtitle: `"Step X of Y · {application.currentStepLabel}"` in `rgba(255,255,255,0.7)`
- CTA button (ghost white): `"Open application →"` → `/application`

**Card B — Documents (white wallet card):**
- Title: `"Documents"` `font-bold, text-primary, text-[12px]` + `"See all"` pill in `text-accent-600, bg-accent-50`
- Apple Wallet–style stacked cards filling the remaining card height. Each card is a document:
  - 5 overlapping cards at slight rotation offsets (`-5deg` to `0deg`), stacked using `position: absolute, bottom: offset`
  - Card dimensions: `height: 42px, border-radius: 8px`
  - Card 5 (back): muted grey-purple gradient — generic/placeholder
  - Card 4: warm gold gradient — `"ECA ASSESSMENT"` label
  - Card 3: red gradient — `"POLICE CERTIFICATE"` + status badge `"Pending"`
  - Card 2: amber/orange gradient — `"LANGUAGE SCORES"` + status badge `"Expiring"`
  - Card 1 (front): deep accent gradient — passport card with user name + `"Valid"` + expiry + two overlapping circles icon
  - Pull document data from `documents` array if available; fall back to these defaults
- No button at the bottom — the wallet stack fills the full card height below the title row

**My Pathway Card — State 3 content:**
- Header: Title `"Express Entry"` | CRS: `"482"` (from `pathwayMatch.crs_score`)
- Subtitle: pathway stream name e.g. `"Federal Skilled Worker"` italic | Pool rank: `"Top 15% of pool"`
- Checklist (5 steps — driven by `application.steps` array, current step expanded):
  1. ✓ Profile submitted ← done (`text-tertiary`)
  2. ● Invitation to apply ← **active** (`text-primary, font-extrabold`) + `"Active · exp {date}"` status dot in `status.inProgress` colors
     - CTA: `"Continue application →"` btn-primary → `/application`
  3. ○ Medical exam ← upcoming (`text-secondary`) + subtitle: `"Unlocks after submission"`
  4. ○ COPR issued ← upcoming + subtitle: `"Confirmation of permanent residence"`
  5. ○ Landing ← upcoming + subtitle: `"Est. {estimatedLandingDate}"`

---

### State 4 — Application Submitted

**Card A — Submission Confirmed (white card):**
- Thin `2px` left accent border using `status.submitted.border` color
- `CheckCircle` lucide icon at top in `status.submitted.dot` color, `20px`
- Title: `"Application Submitted"` `font-extrabold, text-primary, text-[13px]`
- Subtitle: `"Your application has been submitted to IRCC."` `text-secondary, text-[8.5px]`
- Submitted date: from `application.submittedAt`, formatted — `text-tertiary, text-[8px]`
- CTA: `"View application →"` btn-secondary → `/application`

**Card B — Key Dates (white card):**
- Eyebrow: `"WHAT'S NEXT"` `text-tertiary, uppercase`
- Title: `"Key Dates"` `font-bold, text-primary, text-[12px]`
- 3–4 date rows from application data:
  - Each row: small status dot color-coded + date label + date value (bold)
  - `"Biometrics deadline"` — amber dot — `application.biometricsDeadline`
  - `"Medical exam window"` — blue dot — `application.medicalWindow`
  - `"Est. IRCC decision"` — accent dot — `application.estimatedDecision`
  - `border-b border-border-light` between rows
- If dates are not yet available, show `"—"` with `text-tertiary`

**My Pathway Card — State 4 content:**
- Header: Title: pathway name | CRS: score
- Subtitle: stream name | Status: `"Submitted ✓"` in `status.submitted.text` color
- Checklist (5 steps, steps 1–2 done, step 3 active):
  1. ✓ Profile submitted ← done
  2. ✓ Application submitted ← done (show in `status.submitted` accent instead of regular done color)
  3. ● Biometrics ← **active**, CTA: `"Complete biometrics →"` btn-primary
  4. ○ Medical exam ← upcoming
  5. ○ Decision / Landing ← upcoming + subtitle: `"Est. {estimatedDate}"`

---

## 7. Component File Map

```
src/components/dashboard/
├── DashboardShell.tsx          ← REFACTOR: remove sidebar, add TopNav
├── DashboardGrid.tsx           ← REFACTOR: new 2-col layout
├── TopNav.tsx                  ← CREATE: horizontal nav bar
├── GreetingHeader.tsx          ← CREATE: date + greeting line
├── MapCard.tsx                 ← CREATE: always-present SVG world map
├── MyPathwayCard.tsx           ← REFACTOR: header + checklist structure
└── states/
    ├── OnboardingIncompleteGrid.tsx  ← REFACTOR: Card A + Card B content
    ├── PathwayNotSelectedGrid.tsx    ← REFACTOR: Card A + Card B content
    ├── ApplicationInProgressGrid.tsx ← REFACTOR: progress card + docs wallet
    └── ApplicationSubmittedGrid.tsx  ← REFACTOR: status card + key dates
```

---

## 8. Build Order

1. `TopNav.tsx` — no data deps, just layout
2. `GreetingHeader.tsx` — simple, no data deps
3. `MapCard.tsx` — static SVG
4. `DashboardShell.tsx` — wire TopNav, remove sidebar
5. `MyPathwayCard.tsx` — accepts `state` + `data` props
6. `ApplicationInProgressGrid.tsx` — primary state, most detail, build first
7. `OnboardingIncompleteGrid.tsx`, `PathwayNotSelectedGrid.tsx`, `ApplicationSubmittedGrid.tsx`
8. `DashboardGrid.tsx` — wire all state grids together

---

## 9. Do Nots

- ❌ Do not change `tailwind.config.ts`, `globals.css`, or `DESIGN_SPEC.md`
- ❌ Do not change `useDashboardState.ts` or `getDashboardData.ts`
- ❌ Do not change the color palette — use existing tokens throughout
- ❌ Do not use a sidebar layout anywhere — top nav only
- ❌ Do not use external map libraries — inline SVG only
- ❌ Do not apply the sheen/accent treatment to more than one card per state
- ❌ Do not use border-radius smaller than `rounded-card` (16px) on cards
- ❌ Do not add padding smaller than `p-[14px]` inside cards
- ❌ Do not add a white background to the map card container — SVG is the background