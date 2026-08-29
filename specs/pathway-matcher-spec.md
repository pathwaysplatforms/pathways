# Pathway Matcher Spec
## `feat/pathway-matcher` branch

> **Read first:** `tailwind.config.ts`, `specs/design-system.md`,
> `supabase/migrations/20260521081846_expand_profiles.sql`,
> `supabase/migrations/20260521083246_expand_profiles_v2.sql`,
> `supabase/migrations/20260515000003_pathways.sql`

---

## Overview: How All the Pieces Fit Together

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│                                                                 │
│  Scraper (Python)                                               │
│  ├── pathway_scraper.py  →  immigration_sources (RAG content)   │
│  │                       →  immigration_chunks  (embeddings)    │
│  └── draws scraper       →  immigration_draws   (CRS cutoffs)   │
│                                         ↑                       │
│                                  Used by matcher                │
│                                  to show ITA likelihood         │
│                                                                 │
│  Hand-seeded (already done)                                     │
│  └── pathways table      →  eligibility rules per stream        │
│      document_requirements → checklist per pathway              │
│      pathway_steps          → ordered steps per pathway         │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                      MATCHER SERVICE                            │
│  src/modules/pathways/service.ts                                │
│                                                                 │
│  Input:  profiles row (from voice onboarding)                   │
│  Step 1: Hard eligibility filter against pathways table         │
│  Step 2: CRS score calculation from profile fields              │
│  Step 3: ITA likelihood from immigration_draws (latest cutoffs) │
│  Output: ranked MatchResult[]                                   │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                    /onboarding/matches                          │
│  Ranked pathway cards → user picks one                          │
│  → selectPathway() server action                                │
│  → INSERT into applications (status: draft)                     │
│  → redirect to /applications/[id]                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create / Modify

```
src/modules/pathways/
  service.ts          ← matcher service (CREATE)
  types.ts            ← shared types, extend existing (MODIFY)

src/app/
  onboarding/matches/
    page.tsx          ← replace stub with real matcher output (MODIFY)
  api/pathways/
    match/route.ts    ← GET endpoint wrapping matcher (CREATE)
    select/route.ts   ← POST endpoint for selectPathway (CREATE)

src/components/
  matching/
    MatchCard.tsx     ← pathway result card (CREATE)
    MatchList.tsx     ← ranked list wrapper (CREATE)
    CrsScoreBar.tsx   ← visual CRS score indicator (CREATE)
```

---

## 1. Types (`src/modules/pathways/types.ts`)

Add these to the existing types file — do not replace existing Step/StepType
types already there from the application shell work.

```typescript
// Profile shape the matcher receives — maps directly to profiles table columns
export interface MatcherProfile {
  id: string
  // Core eligibility
  has_degree: boolean | null
  years_experience: number | null
  education_level: string | null
  eca_obtained: boolean | null
  // Language
  clb_speaking: number | null
  clb_listening: number | null
  clb_reading: number | null
  clb_writing: number | null
  // Work split
  canadian_work_years: number | null
  foreign_work_years: number | null
  canadian_work_recent: boolean | null
  foreign_work_recent: boolean | null
  noc_teer_category: number | null
  // Spouse
  spouse_coming_to_canada: boolean | null
  spouse_education_level: string | null
  spouse_clb_speaking: number | null
  spouse_clb_listening: number | null
  spouse_clb_reading: number | null
  spouse_clb_writing: number | null
  spouse_canadian_work_years: number | null
  // CRS bonus factors
  has_provincial_nomination: boolean | null
  has_canadian_job_offer: boolean | null
  has_sibling_in_canada: boolean | null
}

// A single pathway match result
export interface MatchResult {
  pathway: {
    id: string
    slug: string
    title: string
    official_name: string
    description: string
    processing_time_min: string
    processing_time_max: string
    program_type: string
  }
  eligible: boolean              // passed all hard gates
  crs_score: number              // calculated CRS score for this profile
  ita_likelihood: 'high' | 'medium' | 'low' | 'unknown'
  latest_cutoff: number | null   // most recent draw cutoff from immigration_draws
  latest_draw_date: string | null
  criteria_met: string[]         // human-readable list of met criteria
  criteria_missing: string[]     // human-readable list of unmet/unknown criteria
  missing_data: string[]         // profile fields that are null — affects confidence
}
```

---

## 2. Matcher Service (`src/modules/pathways/service.ts`)

### 2a. Hard Eligibility Gates

Run these checks per pathway against the profile. A pathway is only returned
if ALL hard gates pass. NULL profile fields are treated as unknown — do NOT
disqualify on NULL, but add the field to `missing_data`.

**FSW (`express-entry-fsw`) gates:**
```
1. noc_teer_category <= 3         (or null → missing_data)
2. years_experience >= 1          (or null → missing_data)
3. min(clb_*) >= 7                (all four abilities, or null → missing_data)
4. has_degree === true             (or null → missing_data)
5. requires_canadian_experience = false → no Canadian experience needed (always passes)
```

**CEC (`express-entry-cec`) gates:**
```
1. noc_teer_category <= 3         (or null → missing_data)
2. canadian_work_years >= 1       AND canadian_work_recent === true
   (if canadian_work_years is null → missing_data, do not disqualify)
3. if noc_teer_category <= 1: min(clb_*) >= 7
   if noc_teer_category >= 2: min(clb_*) >= 5
   (or null → missing_data)
4. No degree or ECA required — always passes
```

**STEM category (`express-entry-stem`) gates:**
```
1. Must pass FSW or CEC gates (checked first)
2. noc_teer_category <= 2         (or null → missing_data)
3. Inherits CLB requirements from whichever underlying stream passes
```

### 2b. CRS Score Calculation

Calculate an approximate CRS score for the profile. This is used for ranking
and ITA likelihood — it does not need to be 100% exact, but must handle the
most significant factors.

Use these point tables (single applicant — with-spouse variant handled below):

**Core / Human Capital factors (max 500 pts single, 460 pts with spouse):**

Age points (single applicant):
```
17 or under  → 0
18–35        → 110
36           → 105
37           → 99
38           → 94
39           → 88
40           → 83
41           → 77
42           → 72
43           → 66
44           → 61
45+          → 0
```
Note: Age is not in the current profile schema. Skip age scoring for now —
add it to `missing_data` and document that it will be added in a future
voice agent extension.

Education points (single applicant):
```
less_than_secondary         → 0
secondary                   → 28
one_year_post_secondary     → 84
two_year_post_secondary     → 91
bachelors                   → 112
two_or_more_credentials     → 119
masters                     → 126
phd                         → 140
```

Language (first official language, per ability, CLB 9+ = 32 pts each):
```
CLB 10+  → 34 per ability (136 max)
CLB 9    → 32 per ability
CLB 8    → 22 per ability
CLB 7    → 16 per ability
CLB 6    → 8  per ability
CLB 5    → 6  per ability
CLB 4    → 6  per ability
Below 4  → 0
```
Sum all four abilities. Max 136 pts (single) / 128 pts (with spouse).

Canadian work experience points:
```
0 years  → 0
1 year   → 40
2 years  → 53
3 years  → 64
4 years  → 72
5+ years → 80
```

**Additional factors:**

Provincial nomination: +600 pts (effectively guarantees ITA)
Canadian job offer (TEER 0): +200 pts
Canadian job offer (TEER 1-2-3): +50 pts
Sibling in Canada (citizen or PR): +15 pts
Canadian education (1-2 years): +15 pts
Canadian education (3+ years): +30 pts

**Spouse factors (if spouse_coming_to_canada = true):**
Add spouse education points at 50% of single rates.
Add spouse CLB points at ~50% of single rates (simplified).
Add spouse Canadian work at 50% rate.

**Implementation note:** Build a `calculateCRS(profile: MatcherProfile): number`
function. Keep each factor as a named constant so it's easy to audit and update
as IRCC adjusts the grid.

### 2c. ITA Likelihood from immigration_draws

Query `immigration_draws` for the latest draw per `draw_type` matching the
pathway's program type:

```typescript
// draw_type values that map to each pathway slug:
const DRAW_TYPE_MAP: Record<string, string[]> = {
  'express-entry-fsw': ['fsw', 'general'],
  'express-entry-cec': ['cec', 'general'],
  'express-entry-stem': ['stem'],
}
```

Fetch the most recent draw for each relevant `draw_type`:
```sql
select draw_type, cutoff_score, draw_date, invitations_issued
from immigration_draws
where country = 'canada'
  and program = 'express_entry'
  and draw_type = ANY($1)
order by draw_date desc
limit 1
```

Then classify ITA likelihood:
```
crs_score >= latest_cutoff + 20  → 'high'
crs_score >= latest_cutoff - 10  → 'medium'
crs_score >= latest_cutoff - 40  → 'low'
crs_score <  latest_cutoff - 40  → 'low' (still show, don't hide)
no draw data                     → 'unknown'
```

If `immigration_draws` is empty (scraper hasn't run yet), use these hardcoded
fallback cutoffs so the matcher works immediately:
```typescript
const FALLBACK_CUTOFFS: Record<string, number> = {
  'general': 525,
  'fsw':     510,
  'cec':     510,
  'stem':    490,
}
```

### 2d. Ranking

Sort `MatchResult[]` by:
1. `eligible` descending (eligible pathways first)
2. `ita_likelihood` score: high=3, medium=2, low=1, unknown=0
3. `crs_score` descending

### 2e. Full Service Function Signature

```typescript
export async function matchPathways(profileId: string): Promise<MatchResult[]>
```

- Fetches profile from `profiles` table using `profileId`
- Fetches all active Canadian pathways from `pathways` table where
  `program_type IN ('express_entry', 'express_entry_category')`
- Runs eligibility gates, CRS calculation, ITA likelihood per pathway
- Returns ranked MatchResult[]
- Throws `DatabaseError` if profile not found
- Never throws on missing profile fields — always degrades gracefully

---

## 3. API Routes

### GET `/api/pathways/match`

```typescript
// src/app/api/pathways/match/route.ts
// Auth required. Returns MatchResult[] for the current user's profile.
// Response: { matches: MatchResult[] }
```

### POST `/api/pathways/select`

```typescript
// src/app/api/pathways/select/route.ts
// Body: { pathway_id: string }
// Auth required.
// 1. Verify pathway exists and is active
// 2. Check no existing non-rejected application for this profile+pathway
// 3. INSERT into applications: { profile_id, pathway_id, status: 'draft' }
// 4. Response: { application_id: string }
```

---

## 4. `/onboarding/matches` Page

Replace the current stub. This is a server component that calls `matchPathways`
directly (no API hop needed — same server).

### Layout

```
Page header:
  "Your Pathway Matches"
  Subtitle: "Based on your profile, here are the immigration pathways
             you may be eligible for."

If missing_data is non-empty on any result:
  → Show a subtle info banner:
    "Some of your profile information is incomplete. Complete your
     profile to see more accurate matches."
    [Complete profile →]  (links to /onboarding/review)

Ranked list of MatchCard components.

If no eligible pathways:
  → Empty state: "We couldn't find any matching pathways based on
    your current profile. Try completing more of your profile, or
    speak to an advisor."
```

### MatchCard component

```
┌────────────────────────────────────────────────────────────┐
│  [Pathway title]                    [ITA likelihood badge] │
│  [Official name — muted]                                   │
│                                                            │
│  [CrsScoreBar: your score vs cutoff]                       │
│                                                            │
│  ✓ You meet the language requirements                      │
│  ✓ Your experience qualifies                               │
│  ✗ Canadian work experience not confirmed                  │
│                                                            │
│  Processing time: 6–12 months                              │
│                                                            │
│  [Select this pathway →]          [Learn more]             │
└────────────────────────────────────────────────────────────┘
```

**ITA likelihood badge colours** (use design system tokens):
- `high` → green/success colour
- `medium` → amber/warning colour
- `low` → muted/secondary colour
- `unknown` → muted, label "Score unknown"

**CrsScoreBar:**
- Shows user's CRS score as a filled bar
- Shows latest cutoff score as a vertical marker line
- Label: "Your score: {n}" and "Latest cutoff: {n}"
- If no cutoff data: show score bar only with "Cutoff data loading"

**"Select this pathway" button:**
- Primary button style from design system
- On click: POST `/api/pathways/select` with `pathway_id`
- On success: redirect to `/applications/[application_id]`
- On error: show inline error message

**Ineligible pathways:**
- Still render but visually dimmed
- Badge: "Not currently eligible"
- Replace select button with "See what's missing →" (expands criteria list)

---

## 5. Null Handling Strategy

This is critical — profile fields will frequently be null, especially before
the voice agent extension is deployed. The matcher must never crash or produce
misleading results.

| Situation | Behaviour |
|-----------|-----------|
| CLB scores all null | Don't disqualify. Add to `missing_data`. Set `ita_likelihood = 'unknown'` |
| `canadian_work_years` null | Don't disqualify from CEC. Add to `missing_data`. |
| `noc_teer_category` null | Don't disqualify. Add to `missing_data`. |
| `education_level` null but `has_degree = true` | Use `bachelors` as conservative estimate. Add to `missing_data`. |
| All CRS inputs null | Return `crs_score = 0`, `ita_likelihood = 'unknown'` |
| `immigration_draws` empty | Use `FALLBACK_CUTOFFS` constants |

---

## 6. How the Scraper Feeds the Matcher

The scraper writes to two tables the matcher uses:

**`immigration_draws`** (populated by `draws` scraper via `canada_draws.py`):
- Contains real CRS cutoff scores per draw type and date
- Matcher queries this for `latest_cutoff` per pathway
- Scraper runs on a schedule (GitHub Actions `scraper-draws.yml`)
- Matcher falls back to `FALLBACK_CUTOFFS` if table is empty

**`immigration_sources` + `immigration_chunks`** (populated by `pathway_scraper.py`):
- Used for RAG — not directly by the matcher
- Will be used in a later feature: AI-generated pathway explanations and
  document guidance inside the application flow
- The matcher does NOT query these tables — it uses the structured
  `pathways` table you hand-seeded

This separation is intentional:
- Structured eligibility rules → `pathways` table (hand-seeded, scraper
  keeps thresholds fresh in future)
- Unstructured content for AI answers → `immigration_chunks` (scraper-owned)
- Live draw results → `immigration_draws` (scraper-owned, matcher reads)

---

## 7. Implementation Notes for Cursor

- Build and test `calculateCRS()` in isolation first with a few known
  profile examples before wiring it into the full matcher
- The `matchPathways()` function should make exactly 2 DB queries:
  one for the profile, one for pathways + one for draws. No N+1 queries.
- All pathway eligibility logic lives in `service.ts` only — no eligibility
  logic in components
- The `/onboarding/matches` page is a server component; only the
  "Select pathway" button interaction needs `'use client'`
- TypeScript strict mode — all MatchResult fields must be typed, no `any`
- After `selectPathway` succeeds, the `applications` row is created with
  `status = 'draft'`. The dashboard service already handles this state —
  it will automatically show the correct dashboard state once the row exists.
- Do not create a `pathway_matches` table — store nothing in the DB for
  match results. They are computed on demand and cheap to recompute.