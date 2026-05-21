# Pathway Engine — Module Spec

## Overview
Server-side module that reads a user's profile from public.profiles and produces
eligibility determinations, a CRS score, matched pathways, and improvement tips.
All core functions are pure and deterministic. No UI. Reads from profiles table,
writes results to pathway_matches table.

## Source of truth for all CRS point values
https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html
Do not invent or estimate any point values.
## Reference links (read before implementing)
- CRS criteria and full point tables:
  https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html
- FSW six selection factors grid:
  https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers/six-selection-factors-federal-skilled-workers.html
- Recent draw history (for context only — engine uses 470 fallback for now):
  https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html
- CRS score verifier (use to validate calculator output):
  https://www.ircctracker.org/crs

## Critical rule
As of March 25, 2025, job offers no longer award CRS points.
has_canadian_job_offer is used only for FSW eligibility and FST eligibility.
Never award CRS points for it.

## File structure
src/modules/pathways/
├── constants/
│   ├── crsPointTables.ts
│   ├── pathwayDefinitions.ts
│   └── drawHistory.ts
├── lib/
│   ├── eligibilityChecker.ts
│   ├── crsCalculator.ts
│   ├── pathwayMatcher.ts
│   └── scoreAdvisor.ts
├── types.ts
├── index.ts
└── __tests__/
    ├── eligibilityChecker.test.ts
    ├── crsCalculator.test.ts
    ├── pathwayMatcher.test.ts
    └── scoreAdvisor.test.ts

## types.ts

```typescript
export type EducationLevel =
  | 'less_than_secondary'
  | 'secondary'
  | 'one_year_post_secondary'
  | 'two_year_post_secondary'
  | 'bachelors'
  | 'two_or_more_credentials'
  | 'masters'
  | 'phd'

// TODO: when adding Australia/UK, prefix with country: 'ca_fsw' | 'au_skilled' etc.
export type ProgramId = 'fsw' | 'cec' | 'fst'

export type EligibilityResult = {
  program: ProgramId
  eligible: boolean
  reasons: string[]
  missing_criteria: string[]
}

export type CRSBreakdown = {
  core: {
    age: number
    education: number
    first_language: number
    second_language: number
    canadian_work: number
    subtotal: number
  }
  spouse: {
    education: number
    language: number
    canadian_work: number
    subtotal: number
  }
  skill_transferability: {
    education_language: number
    education_canadian_work: number
    foreign_work_language: number
    foreign_work_canadian_work: number
    trade_certificate: number
    subtotal: number
  }
  additional: {
    provincial_nomination: number
    french_skills: number
    canadian_education: number
    sibling: number
    subtotal: number
  }
  total: number
}

export type Competitiveness = 'strong' | 'competitive' | 'below_cutoff'

export type PathwayMatch = {
  pathway_id: string
  program: ProgramId
  name: string
  description: string
  crs_score: number
  crs_breakdown: CRSBreakdown
  recent_cutoff: number
  competitiveness: Competitiveness
  processing_months_estimate: number
  next_steps: string[]
}

export type ScoreImprovementTip = {
  action: string
  points_gain_estimate: number
  difficulty: 'easy' | 'medium' | 'hard'
  timeframe: string
}

export type PathwayEngineResult = {
  user_id: string
  eligibility: EligibilityResult[]
  matches: PathwayMatch[]
  improvement_tips: ScoreImprovementTip[]
  calculated_at: string
  data_completeness_warning: boolean
}
```

## constants/crsPointTables.ts

All values from the official canada.ca page. Typed const objects.

```typescript
export const AGE_POINTS = {
  withSpouse: {
    17: 0, 18: 90, 19: 95,
    20: 100, 21: 100, 22: 100, 23: 100, 24: 100,
    25: 100, 26: 100, 27: 100, 28: 100, 29: 100,
    30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70,
    36: 65, 37: 60, 38: 55, 39: 50, 40: 45,
    41: 35, 42: 25, 43: 15, 44: 5, 45: 0
  },
  withoutSpouse: {
    17: 0, 18: 99, 19: 105,
    20: 110, 21: 110, 22: 110, 23: 110, 24: 110,
    25: 110, 26: 110, 27: 110, 28: 110, 29: 110,
    30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77,
    36: 72, 37: 66, 38: 61, 39: 55, 40: 50,
    41: 39, 42: 28, 43: 17, 44: 6, 45: 0
  }
} as const

export const EDUCATION_POINTS = {
  withSpouse: {
    less_than_secondary: 0, secondary: 28,
    one_year_post_secondary: 84, two_year_post_secondary: 91,
    bachelors: 112, two_or_more_credentials: 119,
    masters: 126, phd: 140,
  },
  withoutSpouse: {
    less_than_secondary: 0, secondary: 30,
    one_year_post_secondary: 90, two_year_post_secondary: 98,
    bachelors: 120, two_or_more_credentials: 128,
    masters: 135, phd: 150,
  }
} as const

// Points per ability. Multiply across 4 abilities for total.
export const FIRST_LANG_POINTS_PER_ABILITY = {
  withSpouse:    { 0:0,1:0,2:0,3:0,4:6,5:6,6:8,7:16,8:22,9:29,10:32,11:32,12:32 },
  withoutSpouse: { 0:0,1:0,2:0,3:0,4:6,5:6,6:9,7:17,8:23,9:31,10:34,11:34,12:34 }
} as const

export const SECOND_LANG_POINTS_PER_ABILITY = {
  withSpouse:    { 0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:3,8:3,9:6,10:6,11:6,12:6 },
  withoutSpouse: { 0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:3,8:3,9:6,10:6,11:6,12:6 }
} as const

export const SECOND_LANG_CAP = { withSpouse: 22, withoutSpouse: 24 } as const

export const CANADIAN_WORK_POINTS = {
  withSpouse:    { 0:0, 1:35, 2:46, 3:56, 4:63, 5:70 },
  withoutSpouse: { 0:0, 1:40, 2:53, 3:64, 4:72, 5:80 }
} as const

export const SPOUSE_EDUCATION_POINTS = {
  less_than_secondary: 0, secondary: 2,
  one_year_post_secondary: 6, two_year_post_secondary: 7,
  bachelors: 8, two_or_more_credentials: 9,
  masters: 10, phd: 10,
} as const

export const SPOUSE_LANG_POINTS_PER_ABILITY = {
  0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:3,8:3,9:5,10:5,11:5,12:5
} as const

export const SPOUSE_WORK_POINTS = {
  0:0, 1:5, 2:7, 3:8, 4:9, 5:10
} as const
```

## constants/pathwayDefinitions.ts

```typescript
import type { ProgramId } from '../types'

export type PathwayDefinition = {
  id: string
  program: ProgramId
  name: string
  description: string
  processing_months_estimate: number
  target_audience: string
  next_steps: string[]
}

export const PATHWAY_DEFINITIONS: PathwayDefinition[] = [
  {
    id: 'ca_express_entry_fsw',
    program: 'fsw',
    name: 'Express Entry — Federal Skilled Worker',
    description: 'For internationally trained professionals with foreign work experience seeking Canadian permanent residence.',
    processing_months_estimate: 6,
    target_audience: 'Skilled workers outside Canada with 1+ years of foreign skilled work experience',
    next_steps: [
      'Obtain an Educational Credential Assessment (ECA) if your degree is from outside Canada',
      'Take an approved language test (IELTS or CELPIP for English, TEF Canada or TCF Canada for French)',
      'Create your Express Entry profile on the IRCC website',
      'Enter the Express Entry pool and wait for an Invitation to Apply (ITA)',
      'Submit your permanent residence application within 90 days of receiving your ITA',
    ]
  },
  {
    id: 'ca_express_entry_cec',
    program: 'cec',
    name: 'Express Entry — Canadian Experience Class',
    description: 'For skilled workers with recent Canadian work experience seeking permanent residence.',
    processing_months_estimate: 6,
    target_audience: 'Workers in Canada with 1+ years of recent skilled Canadian work experience',
    next_steps: [
      'Confirm your occupation qualifies under NOC TEER 0, 1, 2, or 3',
      'Ensure your language test results are less than 2 years old',
      'Create your Express Entry profile on the IRCC website',
      'Enter the pool and wait for an Invitation to Apply (ITA)',
      'Submit your permanent residence application within 90 days of your ITA',
    ]
  },
  {
    id: 'ca_express_entry_fst',
    program: 'fst',
    name: 'Express Entry — Federal Skilled Trades',
    description: 'For workers with experience in designated skilled trade occupations.',
    processing_months_estimate: 6,
    target_audience: 'Tradespeople with 2+ years in a designated trade and a job offer or trade certificate',
    next_steps: [
      'Confirm your occupation is on the designated trades list',
      'Obtain a valid Canadian job offer OR a provincial/territorial certificate of qualification',
      'Take an approved language test',
      'Create your Express Entry profile on the IRCC website',
      'Submit your PR application within 90 days of your ITA',
    ]
  }
]
```

## constants/drawHistory.ts

```typescript
// TODO: implement real draw history data — see future specs/draw-history.md
// Will be populated with IRCC draw results and updated regularly
export function getRecentCutoff(_program: string): number {
  return 470 // conservative fallback cutoff
}
```

## lib/eligibilityChecker.ts

```typescript
import type { Database } from '@/types/database'
import type { EligibilityResult, ProgramId } from '../types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function checkEligibility(profile: Profile): EligibilityResult[]
```

Returns one EligibilityResult for each program: fsw, cec, fst.
Always returns all three — eligible: false with reasons if they don't qualify.

### FSW rules (all must be true)
- foreign_work_years >= 1 AND foreign_work_recent === true
- noc_teer_category in [0, 1, 2, 3]
- clb_reading >= 7 AND clb_writing >= 7 AND clb_speaking >= 7 AND clb_listening >= 7
- education_level not null and not 'less_than_secondary'
- FSW selection grid score >= 67 (calculate inline — see grid below)

### CEC rules (all must be true)
- canadian_work_years >= 1 AND canadian_work_recent === true
- If noc_teer_category in [0, 1, 2]: all CLB >= 7
- If noc_teer_category === 3: all CLB >= 5

### FST rules (all must be true)
- foreign_work_years >= 2
- has_trade_certificate === true OR has_canadian_job_offer === true
- clb_speaking >= 5 AND clb_listening >= 5
- clb_reading >= 4 AND clb_writing >= 4

### FSW selection grid (max 100, need >= 67)

Age (max 12):
  18-35: 12 | 36:11 | 37:10 | 38:9 | 39:8 | 40:7
  41:6 | 42:5 | 43:4 | 44:3 | 45:2 | 46:1 | 47+:0 | under 18:0

Education (max 25):
  less_than_secondary:0 | secondary:5 | one_year_post_secondary:15
  two_year_post_secondary:19 | bachelors:21 | two_or_more_credentials:22
  masters:23 | phd:25

Language first official (max 20, 5pts per ability at CLB 9+):
  CLB 4-5:1 | CLB 6:2 | CLB 7-8:4 | CLB 9+:5 per ability

Language second official (max 4, only if first lang >= CLB 7):
  CLB 5-6:1 | CLB 7-8:2 | CLB 9+:3 per ability, max 4 total

Work experience (max 15):
  1yr:9 | 2yr:11 | 3yr:13 | 4yr+:15

Arranged employment (max 10):
  has_canadian_job_offer === true: 10

Adaptability (max 10 combined):
  spouse_coming_to_canada AND any spouse CLB >= 4: 5
  canadian_education_years >= 1: 5
  canadian_work_years >= 1: 5
  has_sibling_in_canada: 5
  Cap at 10

Sum all factors. Include grid score in reasons string.

## lib/crsCalculator.ts

```typescript
import type { Database } from '@/types/database'
import type { CRSBreakdown } from '../types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function calculateCRS(profile: Profile): CRSBreakdown
```

hasSpouse = profile.spouse_coming_to_canada === true
key = hasSpouse ? 'withSpouse' : 'withoutSpouse'

Helper:
```typescript
function workBucket(years: number | null): 0|1|2|3|4|5 {
  if (!years || years <= 0) return 0
  if (years >= 5) return 5
  return years as 1|2|3|4
}
function clampCLB(clb: number | null): number {
  return Math.min(Math.max(clb ?? 0, 0), 12)
}
```

### Section A — Core

Age: look up Math.min(profile age, 45) in AGE_POINTS[key].
Derive age from profile.date_of_birth if available, otherwise use a
dedicated age field if present. If neither exists, award 0 and flag.

Education: EDUCATION_POINTS[key][profile.education_level ?? 'less_than_secondary']

First language: sum FIRST_LANG_POINTS_PER_ABILITY[key][clampCLB(clb)]
for each of reading, writing, speaking, listening.

Second language: sum SECOND_LANG_POINTS_PER_ABILITY[key][clampCLB(clb)]
for each of second_lang_reading, second_lang_writing, second_lang_speaking,
second_lang_listening. Cap at SECOND_LANG_CAP[key].

Canadian work: CANADIAN_WORK_POINTS[key][workBucket(profile.canadian_work_years)]

core.subtotal = age + education + first_language + second_language + canadian_work

### Section B — Spouse (all zero if hasSpouse is false)

education: SPOUSE_EDUCATION_POINTS[profile.spouse_education_level ?? 'less_than_secondary']
language: sum SPOUSE_LANG_POINTS_PER_ABILITY[clampCLB(clb)] for four spouse
  CLB fields. Cap at 20.
canadian_work: SPOUSE_WORK_POINTS[workBucket(profile.spouse_canadian_work_years)]
spouse.subtotal = sum, max 40

### Section C — Skill transferability

minCLB = Math.min of all four first language CLB scores (treat null as 0)

Education + language (max 50):
  highEd = education_level in ['bachelors','two_or_more_credentials','masters','phd']
  midEd  = education_level in ['one_year_post_secondary','two_year_post_secondary']
  If highEd: minCLB>=9 → 50 | minCLB>=7 → 25 | else 0
  If midEd:  minCLB>=9 → 25 | minCLB>=7 → 13 | else 0

Education + Canadian work (max 50):
  If highEd: canadian_work_years>=2 → 50 | >=1 → 25 | else 0
  If midEd:  canadian_work_years>=2 → 25 | >=1 → 13 | else 0

Foreign work + language (max 50):
  fw = foreign_work_years ?? 0
  If fw>=3: minCLB>=9 → 50 | minCLB>=7 → 25 | else 0
  If fw 1-2: minCLB>=9 → 25 | minCLB>=7 → 13 | else 0

Foreign work + Canadian work (max 50):
  If fw>=3: canadian_work_years>=2 → 50 | >=1 → 25 | else 0
  If fw 1-2: canadian_work_years>=2 → 25 | >=1 → 13 | else 0

Trade certificate + language (max 50):
  If has_trade_certificate: minCLB>=7 → 50 | minCLB>=5 → 25 | else 0

skill_transferability.subtotal = Math.min(sum of all five, 100)

### Section D — Additional

provincial_nomination: has_provincial_nomination === true ? 600 : 0

french_skills:
  allNclcGe7 = all four nclc scores >= 7 (treat null as 0)
  If allNclcGe7:
    minEnglish = Math.min of four clb scores
    minEnglish >= 5 ? 50 : 25
  Else 0

canadian_education:
  canadian_education_years >= 3 ? 30
  canadian_education_years >= 1 ? 15
  else 0

sibling: has_sibling_in_canada === true ? 15 : 0

additional.subtotal = sum of all four

### Total
total = core.subtotal + spouse.subtotal + skill_transferability.subtotal + additional.subtotal

## lib/pathwayMatcher.ts

```typescript
import type { Database } from '@/types/database'
import type { EligibilityResult, CRSBreakdown, PathwayMatch } from '../types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function matchPathways(
  profile: Profile,
  eligibility: EligibilityResult[],
  breakdown: CRSBreakdown
): PathwayMatch[]
```

For each program where eligible === true:
1. Find PathwayDefinition from PATHWAY_DEFINITIONS by program
2. cutoff = getRecentCutoff(program) — returns 470 for now
3. competitiveness:
   breakdown.total >= cutoff + 20 → 'strong'
   breakdown.total >= cutoff - 20 → 'competitive'
   else → 'below_cutoff'
4. Build PathwayMatch with all fields from types.ts

Sort: strong first, then competitive, then below_cutoff.
Within same tier, sort by processing_months_estimate ascending.

## lib/scoreAdvisor.ts

```typescript
import type { Database } from '@/types/database'
import type { CRSBreakdown, ScoreImprovementTip } from '../types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function generateTips(
  profile: Profile,
  breakdown: CRSBreakdown
): ScoreImprovementTip[]
```

Check each condition. Push tip if applicable. Return sorted by
points_gain_estimate descending.

1. Any CLB score < 9:
   action: 'Retake your language test aiming for CLB 9 in all abilities'
   points_gain_estimate: 30 | difficulty: 'medium' | timeframe: '3–6 months'

2. canadian_work_years === 0 or null:
   action: 'Gaining Canadian work experience unlocks CEC eligibility and skill transferability points'
   points_gain_estimate: 40 | difficulty: 'hard' | timeframe: '12 months minimum'

3. Any nclc score null or < 7:
   action: 'Achieving NCLC 7+ in French adds 25–50 bonus CRS points'
   points_gain_estimate: 25 | difficulty: 'hard' | timeframe: '6–18 months'

4. canadian_education_years === 0 or null:
   action: 'A 1–2 year Canadian post-secondary credential adds education bonus points'
   points_gain_estimate: 15 | difficulty: 'hard' | timeframe: '1–2 years'

5. has_provincial_nomination === false or null:
   action: 'A Provincial Nominee Program nomination adds 600 CRS points, virtually guaranteeing an invitation'
   points_gain_estimate: 600 | difficulty: 'medium' | timeframe: '3–12 months depending on province'

## index.ts

```typescript
export async function runPathwayEngine(userId: string): Promise<PathwayEngineResult>
```

Steps:
1. Read profile from public.profiles where id = userId using server Supabase client
2. If not found, throw NotFoundError
3. Log { action: 'pathway_engine.started', userId }
4. checkEligibility(profile)
5. calculateCRS(profile)
6. matchPathways(profile, eligibility, breakdown)
7. generateTips(profile, breakdown)
8. Upsert result to pathway_matches (unique on user_id)
9. Log { action: 'pathway_engine.completed', userId, crs_score: breakdown.total, matches: matches.length }
10. Return PathwayEngineResult

data_completeness_warning = profile.incomplete_fields?.length > 0

## Database migration

Create supabase/migrations/[timestamp]_pathway_matches.sql:

```sql
create table public.pathway_matches (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  result         jsonb       not null,
  crs_score      integer     not null,
  top_pathway_id text,
  calculated_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index pathway_matches_user_id_idx on public.pathway_matches(user_id);

alter table public.pathway_matches enable row level security;

create policy "users can read own pathway matches"
  on public.pathway_matches for select to authenticated
  using (auth.uid() = (select auth_user_id from public.profiles where id = user_id));

create policy "service role can write pathway matches"
  on public.pathway_matches for all
  using (auth.role() = 'service_role');

create trigger set_pathway_matches_updated_at
  before update on public.pathway_matches
  for each row execute function public.set_updated_at();
```

## Tests

### eligibilityChecker.test.ts

Base fixture (override per test):
```typescript
const base = {
  age: 28,
  education_level: 'bachelors',
  clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
  foreign_work_years: 2, foreign_work_recent: true,
  canadian_work_years: 0, canadian_work_recent: false,
  noc_teer_category: 1,
  spouse_coming_to_canada: false,
  has_trade_certificate: false,
  has_canadian_job_offer: false,
  has_sibling_in_canada: false,
  has_provincial_nomination: false,
}
```

- base → FSW eligible
- foreign_work_recent: false → FSW ineligible, reason mentions recency
- clb_reading: 6 → FSW ineligible, reason mentions CLB minimum
- canadian_work_years: 1, canadian_work_recent: true, noc_teer_category: 1 → CEC eligible
- canadian_work_years: 0 → CEC ineligible
- foreign_work_years: 2, has_trade_certificate: true, clb_speaking: 5,
  clb_listening: 5, clb_reading: 4, clb_writing: 4 → FST eligible
- FSW grid: base profile → assert grid score >= 67

### crsCalculator.test.ts
- Age 25 no spouse → core.age === 110
- Age 25 with spouse → core.age === 100
- PhD no spouse → core.education === 150
- CLB 9 all abilities no spouse → core.first_language === 124
- CLB 10 all abilities no spouse → core.first_language === 136
- 3 canadian work years no spouse → core.canadian_work === 64
- Spouse education bachelors → spouse.education === 8
- Bachelors + CLB 9 all → skill_transferability.education_language === 50
- Skill transferability total never exceeds 100 even if combinations sum higher
- Provincial nomination → additional.provincial_nomination === 600

### pathwayMatcher.test.ts
- Only eligible programs in results
- CRS 510, cutoff 470 → competitiveness 'strong'
- CRS 460, cutoff 470 → competitiveness 'competitive'
- CRS 440, cutoff 470 → competitiveness 'below_cutoff'
- Strong results before competitive in output

### scoreAdvisor.test.ts
- CLB 7 on any ability → language tip present
- All CLB >= 9 → no language tip
- canadian_work_years null → Canadian work tip present
- All nclc null → French tip present
- Tips sorted by points_gain_estimate descending

## Definition of done
- npx tsc --noEmit — zero errors
- npm run test:unit — all tests pass
- npm run test:integration:
  - runPathwayEngine reads seeded profile from local Supabase
  - Result written to pathway_matches table
  - Running twice for same user upserts, not duplicates
- CRS output for a test profile verified against ircctracker.org within 2 points