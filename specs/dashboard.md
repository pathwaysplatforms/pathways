# Dashboard Implementation Spec
# Place at: `specs/dashboard.md`

> **Claude Code instruction**: Before writing a single line of code, read these files in order:
> 1. `specs/design-system.md` — all visual tokens, typography, component classes
> 2. `specs/copy-and-tone.md` — all user-facing text must follow this
> 3. This file — dashboard logic, layout, data, and card content
>
> Then check `specs/database-schema.md` and `src/types/database.ts` for exact column names.
> Do not guess schema fields — they are all documented.

---

## Overview

The dashboard is a **single route** (`/dashboard`) with **one persistent shell** (sidebar + main
area) and **four content states**. State is derived server-side from the authenticated user's
profile and application records. No routing differences between states — only the card grid
content changes.

The `/dashboard` route already exists in `CLAUDE.md`'s URL structure. The middleware at
`middleware.ts` handles the onboarding gate — users with `onboarding_status = 'not_started'`
are redirected to `/onboarding` before reaching this page. The dashboard therefore only needs
to handle `onboarding_status` values of `'in_progress'` (incomplete) and `'complete'`.

---

## File Structure to Create

```
src/
├── app/
│   └── dashboard/
│       └── page.tsx                        ← server component: fetch data, render shell
├── components/
│   └── dashboard/
│       ├── DashboardShell.tsx              ← sidebar + content wrapper (always rendered)
│       ├── DashboardGrid.tsx               ← client component: receives data, renders card grid
│       ├── DashboardSkeleton.tsx           ← loading skeleton matching the 3-col grid
│       ├── cards/
│       │   ├── MyPathwayCard.tsx           ← col 1 top — accent card, varies by state
│       │   ├── ApplicationCard.tsx         ← col 1 bottom — white card, varies by state
│       │   ├── StepTrackerCard.tsx         ← col 2 full height — white card, varies by state
│       │   ├── RecommendationsCard.tsx     ← col 3 top — white card, varies by state
│       │   └── DocumentsCard.tsx           ← col 3 bottom — white card, varies by state
└── modules/
    └── dashboard/
        ├── types.ts                        ← DashboardState + all data types
        ├── service.ts                      ← getDashboardData() server function
        └── __tests__/
            └── service.test.ts             ← unit tests for getDashboardData
```

Follow the module pattern from CLAUDE.md. Business logic lives in
`src/modules/dashboard/service.ts`, not in the page or components.

---

## State Derivation

State is derived **server-side** inside `getDashboardData()` from two sources:
- `profiles` row for the authenticated user
- `applications` row for that profile (may not exist)

```ts
// src/modules/dashboard/types.ts

export type DashboardState =
  | 'onboarding_incomplete'   // profiles.onboarding_status !== 'complete'
  | 'pathway_not_selected'    // onboarding complete, no applications row exists
  | 'application_in_progress' // applications row exists, submitted_at IS NULL
  | 'application_submitted';  // applications row exists, submitted_at IS NOT NULL
```

**Derivation logic** (implement in `service.ts`):

```ts
function deriveDashboardState(
  profile: Tables<'profiles'>,
  application: Tables<'applications'> | null
): DashboardState {
  if (profile.onboarding_status !== 'complete') {
    return 'onboarding_incomplete';
  }
  if (!application) {
    return 'pathway_not_selected';
  }
  if (!application.submitted_at) {
    return 'application_in_progress';
  }
  return 'application_submitted';
}
```

**`onboarding_status` values** (from `20260515000004_profiles.sql` and
`20260521081846_expand_profiles.sql`):
- `'not_started'` — middleware redirects away before dashboard loads
- `'in_progress'` — maps to `onboarding_incomplete` state
- `'voice_complete'` — middleware redirects to `/onboarding/review`
- `'complete'` — onboarding done, proceed to pathway/application states

---

## Data Fetching

Implement `getDashboardData(userId: string)` in `src/modules/dashboard/service.ts`.
This is a server-only function (no `'use client'`). Use the server Supabase client from
`src/lib/supabase/server.ts`. Accept a `logger` parameter per the project's logging pattern.

**Queries to run in parallel** (`Promise.all`):

```ts
// 1. Profile — always required
const profile = await supabase
  .from('profiles')
  .select('*')
  .eq('auth_user_id', userId)
  .single();

// 2. Application — may not exist (use maybeSingle, not single)
const application = await supabase
  .from('applications')
  .select(`
    *,
    pathway:pathways (
      id,
      title,
      official_name,
      processing_time_min,
      processing_time_max
    )
  `)
  .eq('profile_id', profile.data.id)
  .maybeSingle();

// 3. Pathway steps — only if application exists
// Join via applications.pathway_id → pathway_steps.pathway_id
const steps = application.data ? await supabase
  .from('pathway_steps')
  .select('*')
  .eq('pathway_id', application.data.pathway_id)
  .order('step_number', { ascending: true }) : null;

// 4. Documents — only if application exists
// Join application_documents → document_requirements for names
const documents = application.data ? await supabase
  .from('application_documents')
  .select(`
    id,
    status,
    requirement:document_requirements (
      name,
      is_mandatory
    )
  `)
  .eq('application_id', application.data.id) : null;

// 5. Recommended pathways — only if onboarding complete but no application
// For MVP: query active pathways, filter by basic profile eligibility
// Use profiles.has_degree, profiles.years_experience, profiles.english_level
// as the primary eligibility signals. Do NOT call an AI model here.
const recommendedPathways = (!application.data && profile.data?.onboarding_status === 'complete')
  ? await supabase
      .from('pathways')
      .select('id, title, official_name, processing_time_min, processing_time_max')
      .eq('is_active', true)
      .limit(3)
  : null;
```

**Schema field reference** (exact column names from `src/types/database.ts`):

| What the spec needs | Real column | Table |
|---|---|---|
| Onboarding status | `onboarding_status` (text) | `profiles` |
| Profile completeness | `profile_completeness_pct` (number \| null) | `profiles` |
| Incomplete fields list | `incomplete_fields` (string[] \| null) | `profiles` |
| User's full name | `full_name` (text \| null) | `profiles` |
| Application submitted | `submitted_at` (string \| null) | `applications` |
| Application status | `status` (text) | `applications` |
| Pathway name | `title` (text) | `pathways` |
| Pathway official name | `official_name` (text) | `pathways` |
| Processing time range | `processing_time_min` / `processing_time_max` | `pathways` |
| Step title | `title` (text) | `pathway_steps` |
| Step description | `description` (text) | `pathway_steps` |
| Step number | `step_number` (int) | `pathway_steps` |
| Step duration | `estimated_duration` (text) | `pathway_steps` |
| Document name | `name` (text) | `document_requirements` |
| Document status | `status` (text) | `application_documents` |
| Document uploaded | `uploaded_at` (string) | `application_documents` |

**Fields that do NOT exist in the schema yet** — handle gracefully:
- `crs_score` — not stored. Derive a display value from profile fields for MVP:
  use `profile_completeness_pct` as a proxy, or display "—" if unavailable.
  Do NOT add a migration for this without approval. Flag to the developer.
- `profile_expiry_date` — not stored. Omit from the card for MVP. Show "—".
- `application.notes` exists but is free text — do not display on dashboard.
- Medical exam date, COPR date, decision date — not in schema. Show "Pending" for all
  in the `application_submitted` state. Flag this gap to the developer after building.

---

## DashboardData Type

Define in `src/modules/dashboard/types.ts`:

```ts
import { Tables } from '@/types/database';

export type DashboardState =
  | 'onboarding_incomplete'
  | 'pathway_not_selected'
  | 'application_in_progress'
  | 'application_submitted';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export interface RecommendedPathway {
  id: string;
  name: string;
  processingTime: string; // e.g. "6–12 months"
  eligibilityStatus: 'eligible' | 'likely' | 'possible';
}

export interface ApplicationStep {
  id: string;
  stepNumber: number;
  label: string;
  description: string;
  estimatedDuration: string;
  status: 'complete' | 'current' | 'upcoming';
}

export interface DashboardDocument {
  id: string;
  name: string;
  isMandatory: boolean;
  status: string; // raw value from application_documents.status
}

export interface DashboardData {
  state: DashboardState;

  // Always present
  firstName: string;          // derived from profiles.full_name (first word)
  avatarInitials: string;     // first + last initial from profiles.full_name
  profileCompleteness: number; // profiles.profile_completeness_pct ?? 0

  // Onboarding state
  onboardingStatus: string;   // profiles.onboarding_status
  incompleteFields: string[]; // profiles.incomplete_fields ?? []

  // Pathway state
  recommendedPathways: RecommendedPathway[];

  // Application state (all nullable — only present when application exists)
  applicationId: string | null;
  applicationStatus: string | null;   // applications.status
  applicationSubmittedAt: string | null; // applications.submitted_at
  pathwayTitle: string | null;        // pathways.title
  pathwayOfficialName: string | null; // pathways.official_name
  applicationSteps: ApplicationStep[];
  documents: DashboardDocument[];

  // Computed counts
  completedStepsCount: number;
  totalStepsCount: number;
  pendingDocumentsCount: number;
  completedDocumentsCount: number;
}
```

---

## Onboarding Steps (for `onboarding_incomplete` state)

The `profiles` table does not have a discrete steps table — onboarding completeness is tracked
via `incomplete_fields` (string array) and `profile_completeness_pct`. Derive the step list
from the known onboarding sections:

```ts
const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'personal',   label: 'Personal info',     description: 'Name, nationality, current country' },
  { id: 'education',  label: 'Education',          description: 'Degree level and field of study' },
  { id: 'work',       label: 'Work experience',    description: 'Years of experience and occupation' },
  { id: 'language',   label: 'Language scores',    description: 'CLB scores from your English test' },
  { id: 'finances',   label: 'Finances',           description: 'Annual salary and financial situation' },
  { id: 'family',     label: 'Family & intent',    description: 'Marital status, dependents, destination' },
];

// Mark a step completed if none of its associated fields appear in incomplete_fields
const STEP_FIELDS: Record<string, (keyof Tables<'profiles'>)[]> = {
  personal:  ['full_name', 'nationality', 'current_country'],
  education: ['education_level', 'has_degree', 'degree_level', 'degree_field'],
  work:      ['years_experience', 'occupation', 'noc_teer_category'],
  language:  ['english_level', 'clb_listening', 'clb_reading', 'clb_speaking', 'clb_writing'],
  finances:  ['annual_salary_gbp'],
  family:    ['marital_status', 'has_dependents'],
};
```

---

## Application Steps (for `application_in_progress` state)

Steps come from the `pathway_steps` table joined via `applications.pathway_id`.
There is no `application_step_progress` table in the schema — step completion is not
tracked at the row level yet. For MVP, derive step status from document uploads:
- A step is `'complete'` if all mandatory `document_requirements` for that step have
  an `application_documents` row with `status = 'verified'` or `status = 'uploaded'`.
- The first incomplete step is `'current'`.
- All steps after current are `'upcoming'`.

**Flag to developer after building**: a proper `application_step_progress` table would
make this more robust. Do not create it unilaterally — flag the gap.

---

## Dashboard Shell

File: `src/components/dashboard/DashboardShell.tsx`

### Sidebar (desktop — always visible)
- Width: `240px` per CLAUDE.md (not 64px — the spec says 240px for app routes)
- Background: `bg-bg-surface` (`#FFFFFF`)
- Right border: `border-r border-border-light`
- Shadow: `shadow-sidebar`
- Full viewport height: `h-screen`

**Logo** (top of sidebar):
- "Pathways" wordmark, Urbanist 700, `text-text-primary`
- Small filled circle in `bg-accent-500` beside it

**Nav items** (vertical list, icon + label):
- Dashboard → `/dashboard` (Lucide `LayoutDashboard` icon)
- Application → `/applications/[id]` if application exists, else disabled
- Documents → `/applications/[id]/documents` if application exists, else disabled
- Profile → `/profile` (future route — render as link but note it doesn't exist yet)

**Nav item styling** (from `globals.css` `.nav-item` class):
- Default: `text-text-tertiary`
- Hover: `bg-bg-subtle`
- Active: `bg-accent-50 text-accent-600`
- Disabled: `text-text-disabled cursor-not-allowed`

**User avatar** (pinned to bottom):
- Initials from `DashboardData.avatarInitials`
- 36×36px circle, `bg-accent-600`, white text, Urbanist 600

### Top bar
Inline above the card grid, not a fixed positioned element.
- Left: greeting text — `"Good [morning/afternoon/evening], [firstName]"` + full date
  - Greeting: Urbanist 700, `text-text-primary`, 20px
  - Date: Urbanist 400, `text-text-tertiary`, 13px
- Right: dashboard state badge using the correct badge class from `globals.css`:
  - `onboarding_incomplete` → `badge-warning`
  - `pathway_not_selected` → `badge-info`
  - `application_in_progress` → `badge-progress`
  - `application_submitted` → `badge-success`

---

## Grid Layout

File: `src/components/dashboard/DashboardGrid.tsx`

3-column CSS grid. All four dashboard states use **identical grid structure** — only card
content changes.

```
Outer padding:  28px (p-[28px] — use Tailwind arbitrary value only here, not elsewhere)
Gap:            20px (gap-5)
Grid:           grid grid-cols-3
Col 1:          flex flex-col gap-5  (MyPathwayCard + ApplicationCard, equal height)
Col 2:          StepTrackerCard (row-span-2, full height via h-full)
Col 3:          flex flex-col gap-5  (RecommendationsCard ~60% + DocumentsCard ~40%)
```

Card height: the two col-2 cards (StepTrackerCard) should match the combined height of
the two col-1 cards including their gap. Use `grid-rows-[1fr_1fr]` on the outer grid
and `row-span-2` on StepTrackerCard.

---

## Card Definitions

All cards accept an `onExpand?: () => void` prop. When provided, show a Lucide `Maximize2`
icon (14px, `text-text-tertiary`) in the top-right corner. Wire it to `onExpand` on click.
For this sprint, always pass `undefined` — expansion is a future sprint.

---

### Card A — MyPathwayCard

Style: **accent card** (`card-accent` class from `globals.css`) — dark aquamarine with sheen.
All text is white. This is the only accent card on the dashboard.

**`onboarding_incomplete`**
```
Eyebrow:  "MY PATHWAY"  (label-eyebrow, white/60% opacity)
Title:    "Complete your profile"  (card-title, white)
Body:     profile_completeness_pct displayed as a progress bar
          "[N] of 6 sections complete"
          Mini step list (3 items max visible — most recently incomplete):
            Each row: checkmark icon (complete) or circle (incomplete) + step label
CTA:      Button — "Continue onboarding"
          Style: white background, accent-600 text, btn-radius, no sheen
          href: /onboarding
```

**`pathway_not_selected`**
```
Eyebrow:  "MY PATHWAY"
Title:    "Your top matches"
Body:     List of up to 3 recommended pathways (from pathways table query):
            Each row:
              — pathways.title (Urbanist 600, white, 13px)
              — processingTime e.g. "6–12 months"  (caption, white/70%)
              — eligibility badge: "Eligible" (white/20% bg, white text, badge-radius)
          If no pathways returned: "Complete your profile to see matches."
CTA:      None — CTA is on ApplicationCard
```

**`application_in_progress`**
```
Eyebrow:  "MY PATHWAY"
Title:    applications→pathways.title  (e.g. "Skilled Worker Visa")
Subhead:  pathways.official_name  (white/70%, 12px)
Stat:     profile_completeness_pct displayed as large number (Urbanist 800, 30px)
          with label "Profile complete" beneath (white/60%, 11px)
          NOTE: crs_score does not exist in schema. Use profile_completeness_pct
          as the hero stat for MVP. Show "—" if null. Flag gap to developer.
Badge:    applications.status displayed as a pill
          e.g. "In Progress"  (white/20% bg, white text)
Footer:   "Processing: [processing_time_min]–[processing_time_max]"  (caption, white/60%)
```

**`application_submitted`**
```
Eyebrow:  "MY PATHWAY"
Title:    pathways.title
Subhead:  pathways.official_name  (white/70%, 12px)
Section:  "Application Status"  (eyebrow style, white/50%)
Badge:    applications.status  (white/20% bg, white text, pill)
Key dates list:
  — "Submitted"        applications.submitted_at formatted as "DD MMM YYYY"
  — "Medical exam"     "Pending"  (crs fields don't exist — always show Pending)
  — "Decision"         "Pending"
  — "COPR"             "—"
Footer:   applications.id truncated: "Ref: [first 8 chars]"
Note:     Flag to developer: medical/decision/COPR dates need schema additions
```

---

### Card B — ApplicationCard

Style: white base card (`card` class from `globals.css`).

**`onboarding_incomplete`**
```
Title:    "Your Application"
Body:     Lock icon (Lucide Lock, 32px, text-text-disabled, centered)
          "Complete your profile to unlock your application."
          (Urbanist 400, text-text-secondary, text-center)
CTA:      "Start onboarding"  (btn-primary)
          href: /onboarding
```

**`pathway_not_selected`**
```
Title:    "Start Your Application"
Body:     "Choose a pathway to generate your personalised checklist."
          (Urbanist 400, text-text-secondary)
          If recommendedPathways[0] exists:
            "Recommended: [pathway.title]"  (accent-600, 13px, 600 weight)
CTA:      "Browse pathways"  (btn-primary, full width)
          href: /pathways
```

**`application_in_progress`**
```
Title:    "Application Progress"
Body:     Large fraction: "[completedStepsCount] / [totalStepsCount]"
            Numerator: Urbanist 800, 28px, accent-600
            Denominator: Urbanist 400, 16px, text-tertiary
          Label: "steps complete"  (label-eyebrow style)
          Thin progress bar: accent-500 fill on bg-muted track
          Next step label: "Next: [currentStep.label]"
            (Urbanist 500, text-secondary, 13px, truncated)
CTA:      "Continue"  (btn-primary)
          href: /applications/[applicationId]
```

**`application_submitted`**
```
Title:    "Application Submitted"
Body:     Lucide CheckCircle2 icon (36px, text-status-success-dot, centered)
          "Your application has been submitted."
          (text-center, text-secondary)
          Submitted date:  (caption, text-tertiary, text-center)
          e.g. "Submitted 14 May 2026"
CTA:      "View application"  (btn-secondary)
          href: /applications/[applicationId]
```

---

### Card C — StepTrackerCard

Style: white base card, full height (`h-full`), vertically scrollable if steps overflow.
This is the centrepiece. It spans both rows in column 2.

**`onboarding_incomplete`**
```
Eyebrow:  "ONBOARDING CHECKLIST"
Title:    "Getting started"
Steps:    ONBOARDING_STEPS array (6 steps, defined in service.ts)
          Each step node:
            — Circle (20px): filled accent-500 if complete, accent ring if current, bg-muted if upcoming
            — Connector line (1px, bg-border-light) between nodes
            — Step label: Urbanist 600, 14px, text-primary (complete/current) or text-disabled (upcoming)
            — Step description: Urbanist 400, 12px, text-tertiary
            — CTA on current step only: "Complete →" (btn-primary, small: py-1 px-3, text-12px)
              href: /onboarding
Completion shown at top: "[N] of 6 complete"  (badge-progress or badge-warning)
```

**`pathway_not_selected`**
```
Eyebrow:  "NEXT STEPS"
Title:    "Choose your pathway"
Steps:    4 static steps (not from DB):
            1. ✓ Profile complete
            2. → Choose a pathway  ← current
            3. ○ Build your checklist
            4. ○ Submit application
          Current step (2) has CTA: "Browse pathways →"  href: /pathways
Footer:   "Your checklist will be generated automatically once you select a pathway."
          (Urbanist 400, 12px, text-tertiary, border-top, pt-3)
```

**`application_in_progress`**
```
Eyebrow:  "APPLICATION STEPS"
Title:    pathways.title
Steps:    From pathway_steps table, ordered by step_number:
          Each step node:
            — pathway_steps.step_number as circle label
            — pathway_steps.title  (Urbanist 600, 14px)
            — pathway_steps.description  (Urbanist 400, 12px, text-tertiary, 1 line truncated)
            — pathway_steps.estimated_duration  (caption, text-tertiary)
            — Status derived from document uploads (see service.ts logic above)
            — CTA on current step: "Complete →"  href: /applications/[id]
            — Locked: no CTA, text-disabled, no connector (future: locked steps)
Footer:   "[pendingDocumentsCount] docs pending"  (badge, accent-50 bg, accent-700 text)
          Clicking footer → /applications/[id]/documents
```

**`application_submitted`**
```
Eyebrow:  "APPLICATION STEPS"
Title:    "Application complete"
Steps:    Same pathway_steps, all shown as complete (filled green nodes)
          No CTAs — read only
          Final node: large Lucide CheckCircle2 (accent-500) with "Submitted to IRCC"
Footer:   applications.submitted_at formatted date  (caption, text-tertiary)
```

---

### Card D — RecommendationsCard

Style: white base card.

**`onboarding_incomplete`**
```
Title:    "Why complete your profile?"
Body:     3 static benefit rows (Lucide icons, no DB data needed):
            Target     "Get matched to the right pathway"
                       "We analyse 20+ eligibility factors to find your best route."
            ClipboardList  "Generate your personalised checklist"
                           "Every document and step, tailored to your pathway."
            TrendingUp  "Track your application progress"
                        "From first step to landing — all in one place."
          Each row: icon (20px, accent-500) + label (600, 14px) + description (400, 12px, tertiary)
          No CTA.
```

**`pathway_not_selected`**
```
Title:    "How pathway matching works"
Body:     3 static info rows:
            MapPin      "Pathways differ by requirements"
                        "Salary thresholds, experience, and qualifications vary by route."
            Clock       "Processing times vary"
                        "From [processing_time_min] to [processing_time_max] depending on pathway."
            User        "Your profile determines eligibility"
                        "We match you based on your education, work history, and language scores."
          No CTA.
```

**`application_in_progress`**
```
Eyebrow:  "IMPROVE YOUR SCORE"
Title:    "Recommended actions"
Body:     For MVP, show 3 static recommendations derived from incomplete profile fields:
            — If eca_obtained is null/false:
                "Get your ECA"  /  "Foreign credentials recognised in Canada."  / "+15 pts"
            — If has_canadian_job_offer is false:
                "Secure a Canadian job offer"  /  "Significantly increases your score."  / "+50 pts"
            — If canadian_work_years is 0 or null:
                "Canadian work experience"  /  "Even 1 year improves your ranking."  / "+10 pts"
            — Fallback if all above are null:
                "Complete your profile"  /  "A complete profile improves your match accuracy."
          Each row: label (600, 14px) + impact badge (accent-100 bg, accent-800 text) +
          description (400, 12px, tertiary) + "Learn more →" (accent-600, text link, 13px)
          href for each: /pathways (for MVP — specific pages don't exist yet)
Note:     Flag to developer: a recommendations table/engine would make this dynamic.
          For MVP these are derived from known profile gaps.
```

**`application_submitted`**
```
Eyebrow:  "NEXT STEPS"
Title:    "While you wait"
Body:     3 static action rows:
            Calendar    "Book your medical exam"
                        "Required before your visa is issued."  / "Book now →"
            FileText    "Prepare proof of funds"
                        "Have bank statements ready for the past 6 months."  / "Learn more →"
            ExternalLink "Track on IRCC portal"
                         "Check your application status on the official portal."  / "Open portal →"
          href values: external IRCC URLs (use "#" for MVP — flag to developer)
```

---

### Card E — DocumentsCard

Style: white base card. Compact — lower visual priority.

**`onboarding_incomplete`**
```
Title:    "Documents"
Body:     Lock icon (Lucide Lock, 24px, text-disabled, centered)
          "Unlocks after onboarding"  (caption, text-tertiary, text-center)
```

**`pathway_not_selected`**
```
Title:    "Documents"
Body:     Lock icon (Lucide Lock, 24px, text-disabled, centered)
          "Unlocks after selecting a pathway"  (caption, text-tertiary, text-center)
```

**`application_in_progress`**
```
Title:    "Documents"
Counts:   "[pendingDocumentsCount] pending  ·  [completedDocumentsCount] complete"
          (Urbanist 500, 13px, text-secondary)
Stack:    Top 3 pending documents shown as overlapping chips (Apple Wallet style):
            Each chip: white bg, border-border-light, border-radius-badge, shadow-card
            Chip content: document_requirements.name (truncated, 12px) + status dot
            Offset vertically: translate-y-[0] / translate-y-[6px] / translate-y-[12px]
            z-index: 3 / 2 / 1
          If no pending docs: Lucide CheckCircle2 (accent-500) + "All documents complete"
CTA:      "View all →"  (text link, accent-600, 13px, Urbanist 600)
          href: /applications/[applicationId]/documents
```

**`application_submitted`**
```
Title:    "Documents"
Body:     "[completedDocumentsCount] documents submitted"
          (Urbanist 600, 15px, text-primary)
          All docs shown as small rows with green check dots
CTA:      "View all →"  href: /applications/[applicationId]/documents
```

---

## Loading State

File: `src/components/dashboard/DashboardSkeleton.tsx`

Show while `getDashboardData` is resolving. Match the 3-col grid exactly:
- Col 1: two skeleton blocks, equal height, `bg-muted` with `animate-pulse`
- Col 2: one tall skeleton block, same height as combined col-1 blocks
- Col 3: two skeleton blocks (~60% / ~40% split)
- Sidebar: rendered fully (not a skeleton) — user info loads from session

---

## Error State

In `src/app/dashboard/page.tsx`, wrap `getDashboardData` in try/catch.
On error, render a single centred card:
```
Title:    "Something went wrong"
Body:     "We couldn't load your dashboard. Please try again."
CTA:      "Retry"  — triggers a router.refresh()
```
Log the error with the request logger and correlationId before rendering the fallback.

---

## Responsive Behaviour

- Desktop (≥1024px): 3-column grid as specified
- Below 1024px: single column, cards stacked in this order:
  MyPathwayCard → StepTrackerCard → ApplicationCard → RecommendationsCard → DocumentsCard
- Sidebar: at <1024px, hide sidebar. Use a top bar with a hamburger menu (future sprint).
  For MVP, the sidebar can simply be hidden below 1024px with `hidden lg:flex`.

---

## Styling Constraints (critical — from `specs/design-system.md`)

**Read `specs/design-system.md` before writing any JSX.**

- Font: Urbanist only. Import via `next/font/google` in `src/app/layout.tsx` if not already done.
- Card radius: use `rounded-card` Tailwind token (16px) — defined in `tailwind.config.ts`
- Card gap: `gap-5` (20px)
- Outer padding: `p-7` (28px)
- MyPathwayCard: always uses `card-accent` class from `globals.css` (dark aquamarine + sheen)
- All other cards: `card` class from `globals.css` (white, border, shadow-card)
- Interactive cards: add `card-interactive` class — do not add hover transforms manually
- Buttons: `btn-primary` (accent + sheen) or `btn-secondary` (outline) from `globals.css`
- State badges: `badge badge-[warning|info|progress|success]` from `globals.css`
- Locked states: `text-text-disabled` + `bg-bg-muted`
- Status dots: inline `<span>` with `w-1.5 h-1.5 rounded-full` + appropriate bg color
- No arbitrary Tailwind values except `p-[28px]` for outer dashboard padding
- No inline styles except for the document chip translate offsets (Tailwind cannot do dynamic offsets)
- No font-weight 600 or 700 in Tailwind (`font-semibold` / `font-bold`) — use only
  `font-medium` (500) and `font-extrabold` (800) per CLAUDE.md rules
  **Exception**: card titles and labels use `font-semibold` — flag this conflict to developer
- No box shadows on cards (use shadow from globals.css `.card` class only, not Tailwind shadow utilities)
- No more than one `btn-primary` visible per screen at a time
- No placeholder text — use realistic immigration copy per `specs/copy-and-tone.md`

---

## Gaps to Flag to Developer After Building

These are schema or feature gaps encountered during implementation. Do not resolve them
unilaterally — build the MVP fallback described above and flag each one:

1. **`crs_score` column missing** — not in `profiles` table. Displaying `profile_completeness_pct`
   as the hero stat for MVP. A computed `crs_score` column or function would improve this card.

2. **`profile_expiry_date` missing** — Express Entry profiles expire after 12 months.
   Not tracked in schema. Showing "—" for MVP.

3. **Application milestone dates missing** — `medical_exam_date`, `decision_expected_date`,
   `copr_date`, `file_number` are not in `applications` table. All showing "Pending" for MVP.
   These are needed for the `application_submitted` state to be meaningful.

4. **`application_step_progress` table missing** — step completion is derived from document
   uploads as a proxy. A proper step progress table would make this reliable.

5. **Recommendations engine missing** — recommendations are derived from static profile gap
   logic for MVP. A `user_recommendations` table or AI-powered engine is in `specs/ai-features.md`.

6. **`/profile` route missing** — sidebar nav item links to `/profile` which does not exist yet.
   Render it as disabled for now.

---

## Integration Checklist for Claude Code

Work through this in order:

- [ ] Read `specs/design-system.md`, `specs/copy-and-tone.md`, and `src/types/database.ts` before starting
- [ ] `src/modules/dashboard/types.ts` — DashboardState + all interfaces above
- [ ] `src/modules/dashboard/service.ts` — getDashboardData() with real Supabase queries
- [ ] `src/modules/dashboard/__tests__/service.test.ts` — unit tests (mock Supabase)
- [ ] `src/app/dashboard/page.tsx` — server component, auth check, call getDashboardData, handle error
- [ ] `src/components/dashboard/DashboardShell.tsx` — sidebar (240px) + layout wrapper
- [ ] `src/components/dashboard/DashboardSkeleton.tsx` — loading skeleton
- [ ] `src/components/dashboard/DashboardGrid.tsx` — 3-col grid, receives DashboardData
- [ ] `src/components/dashboard/cards/MyPathwayCard.tsx`
- [ ] `src/components/dashboard/cards/ApplicationCard.tsx`
- [ ] `src/components/dashboard/cards/StepTrackerCard.tsx`
- [ ] `src/components/dashboard/cards/RecommendationsCard.tsx`
- [ ] `src/components/dashboard/cards/DocumentsCard.tsx`
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm run test:unit` — all tests pass
- [ ] Run `npm run lint` — zero warnings
- [ ] Flag all 6 schema gaps listed above to developer