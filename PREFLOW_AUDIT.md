# Pathways — Pre-Pathway Flow Audit
*Generated: 2026-05-27*

---

## Current Flow Map

```
UNAUTHENTICATED
      │
      ▼
[ / ]  ──────────────────────────────────────────── ❌ No marketing page
  │                                                   (bare redirect only)
  ▼
[ /auth/login ]  ──────────────────────────────────── ✅ Magic link + Google OAuth
  │                                                    ⚠️ Minimal branding, no trust copy
  ▼
[ /auth/callback ] ────────────────────────────────── ✅ Code exchange + status redirect
  │
  ├── onboarding_status = "complete"      → /dashboard
  ├── onboarding_status = "voice_complete"→ /onboarding/review
  └── else                                → /onboarding

[ /onboarding ] (entry router) ─────────────────────── ✅ Redirects by status
  └── → /onboarding/voice

[ /onboarding/voice ] ──────────────────────────────── ✅ Full-screen Siri orb UI
  │   Gladia WebSocket STT                             ⚠️ No text fallback
  │   Claude Haiku conversation (13 fields)            ⚠️ No progress indicator
  │   ElevenLabs TTS streaming                         ❌ No session resume on tab close
  │   Session data persisted per turn                  ❌ English greeting only
  │
  ▼  (complete=true from Claude)
[ /onboarding/review ] ─────────────────────────────── ✅ Editable 13-field form
  │   Reads from voice_session_data JSONB              ⚠️ Expanded CRS fields not shown
  │   Highlights requires_review fields                ⚠️ No form validation
  │   Confirm → /api/voice/confirm                     ⚠️ No "restart voice" option
  │   Sets onboarding_status = "complete"
  ▼
[ /onboarding/matches ] ────────────────────────────── ❌ STUB — "coming soon"
  │   No pathway matching logic                        ❌ No recommendation engine
  │   No loading/transition state                      ❌ No partial hints
  ▼
[ /dashboard ] ─────────────────────────────────────── ⚠️ Visible but no recommendations
```

**Overall verdict:** A user can complete the pre-pathway flow end-to-end, but the destination — pathway recommendations — does not exist. The flow terminates at a stub.

---

## Critical Blockers

Ranked from most to least severe:

1. **❌ Pathway recommendation engine is absent.** `/onboarding/matches` is a stub page with "coming soon" copy. A user who completes the entire intake arrives at a dead end and is redirected to a dashboard with no recommendations. This is the single most critical gap.

2. **❌ Age / date of birth is never collected or stored.** Age is the largest single contributor in the CRS Core Human Capital section (up to 110 points; 0 points at age 45+). It is absent from the voice system prompt, the `VoiceExtractedProfile` schema, and the `profiles` table schema. No CRS score can be computed without it.

3. **❌ CLB scores are not collected during voice onboarding.** The voice agent collects `english_level` (a loose enum: native/fluent/b2/b1/below_b1). Actual CRS scoring requires four distinct CLB values (reading, writing, speaking, listening). The `profiles` table has columns for these (from `expand_profiles.sql`), but they are never populated. The gap between `english_level` and actual CLB scores is unbridgeable without a second intake phase.

4. **❌ No text/form fallback for voice.** If a user's browser lacks WebRTC support, microphone permission is blocked by policy, or the Gladia WebSocket fails, 100% of new users are blocked with no alternative path.

5. **❌ Mid-session voice continuity is broken.** If a user closes the browser tab mid-conversation, the `voice_sessions` row persists with `status = 'in_progress'` but the middleware still reads `onboarding_status = 'not_started'` on their profile. On return, a fresh voice session is created and the previous partial session is orphaned. Users must repeat the entire conversation.

6. **❌ CRS calculator does not exist.** `/crs` is a stub. The database schema is fully ready (all columns present), but there is no `lib/crs.ts` or equivalent module. No Express Entry CRS score can be computed for any user.

7. **❌ No i18n system.** All user-facing strings are hardcoded English. There is no `lib/i18n.ts`, no locale files, no `useT()` hook, and no translation mechanism. The platform's mandate to serve French-speaking Canadians cannot be met.

---

## Data Gaps (CRS + Pathway Matching)

| Field | Currently Collected in Voice? | Stored in DB? | Notes |
|---|---|---|---|
| `date_of_birth` / `age` | ❌ No | ❌ No column | CRS Core Human Capital: up to 110 pts |
| `clb_reading` | ❌ No | ✅ Column exists | Voice collects vague `english_level` enum only |
| `clb_writing` | ❌ No | ✅ Column exists | Same as above |
| `clb_speaking` | ❌ No | ✅ Column exists | Same as above |
| `clb_listening` | ❌ No | ✅ Column exists | Same as above |
| `language_test_type` | ❌ No | ❌ No column | Which test: IELTS, CELPIP, TEF, TCF |
| `language_test_date` | ❌ No | ❌ No column | Tests expire after 2 years |
| `second_lang_reading/writing/speaking/listening` | ❌ No | ✅ Columns exist | French bonus: up to 50 pts |
| `nclc_reading/writing/speaking/listening` | ❌ No | ✅ Columns exist | French NCLC required for FSW French stream |
| `education_level` (CRS enum) | ❌ No | ✅ Column exists | Voice collects free-text `degree_level` only |
| `canadian_work_years` | ❌ No | ✅ Column exists | CRS Canadian work experience |
| `foreign_work_years` | ❌ No | ✅ Columns exist | Voice collects combined `years_experience` only |
| `noc_teer_category` | ❌ No | ✅ Column exists | Required for FSW/CEC eligibility |
| `noc_code` | ❌ No | ✅ Column exists | 5-digit NOC code |
| `eca_obtained` | ❌ No | ✅ Column exists | Educational Credential Assessment |
| `canadian_education_years` | ❌ No | ✅ Column exists | CRS additional points |
| `has_sibling_in_canada` | ❌ No | ✅ Column exists | CRS: +15 pts |
| `has_provincial_nomination` | ❌ No | ✅ Column exists | CRS: +600 pts |
| `has_canadian_job_offer` | ❌ No | ✅ Column exists | CRS: up to +200 pts |
| `has_trade_certificate` | ❌ No | ✅ Column exists | Skill transferability |
| `spouse_coming_to_canada` | ❌ No | ✅ Column exists | Changes which CRS section applies |
| `spouse_education_level` | ❌ No | ✅ Column exists | CRS Section B spouse points |
| `spouse_clb_*` (4 fields) | ❌ No | ✅ Columns exist | CRS Section B spouse language |
| `spouse_canadian_work_years` | ❌ No | ✅ Column exists | CRS Section B |
| `intended_destination_province` | ❌ No | ❌ No column | Required for PNP matching |
| `settlement_funds` | ❌ No | ❌ No column | Required for FSW/Federal Skilled Trades |
| `adaptability_points` | ❌ No | ❌ No column | FSW points grid |

**Summary:** 25 of the 29 fields needed for a complete CRS calculation are not collected during voice onboarding. The `profiles` table has columns for 20 of these (from the expand_profiles migrations), but none are populated by the current voice flow. Four fields don't exist in the DB at all.

---

## UX Issues

1. **No landing page.** `/` immediately redirects to `/dashboard`. An unauthenticated visitor gets bounced to `/auth/login` with no explanation of what Pathways is, who it's for, or why they should trust it. First-impression conversion is zero.

2. **Login page lacks trust signals.** The page shows only the word "Pathways" and an email form. No tagline, no social proof, no explanation of the magic link flow. The instruction "We'll send you a secure sign-in link" is the only copy. Users unfamiliar with magic links will be confused.

3. **Single undifferentiated auth error.** Any auth failure (expired link, invalid code, network error, user not found) surfaces the identical generic message: "We could not sign you in." Users cannot self-diagnose or know whether to try again, use a different email, or contact support.

4. **No progress signal during voice onboarding.** The user sees an orb and status text. There is no indication of how many questions remain, which fields are collected, or how long the conversation will take. The pre-conversation copy says "about 3 minutes" but this vanishes once started.

5. **No restart option on the review screen.** If the voice agent badly misunderstood the user (wrong name, wrong nationality), there is no "start over" or "redo voice" path. The user can correct individual fields, but a completely garbled session has no recovery path.

6. **Review screen does not expose expanded CRS fields.** After confirming the 13 basic fields, the user has no opportunity to provide CLB scores, NOC code, Canadian work history, or spouse details — which are all present in the database schema but invisible to users.

7. **Matches stub creates a false ending.** After completing what feels like a significant onboarding journey, the user reaches a "coming soon" page. The CTA says "Go to dashboard" but the dashboard also has no recommendations. The user has no sense of what happened to their data or what comes next.

8. **Voice greeting is hardcoded and opaque.** The opening question is "what's your full name, and which country are you currently living in?" — two questions at once, with no explanation of why these are being asked or how the data will be used.

9. **`annual_salary_gbp` is a confusing label.** The review screen shows "Annual salary (GBP)". Users in other countries providing salaries in other currencies receive no confirmation of the conversion rate used or the final converted value.

10. **Design system violations on critical screens.** The login page uses `text-[28px]` (arbitrary Tailwind value, violates CLAUDE.md). The review screen uses raw `bg-white border border-neutral-200 rounded-xl` instead of the `.card` class from globals.css. The matches page uses `font-jakarta` and `font-dm-sans` (neither is the Urbanist-only rule).

---

## Quick Wins

Estimated at under 2 hours each:

1. **Add `date_of_birth` to voice prompt and profiles table** (~1h): Add a single question to the Claude system prompt collecting the user's date of birth. Add the `date_of_birth date` column to the profiles table via migration. No other schema changes needed. This unblocks CRS computation for the most critical variable.

2. **Add session resume for in-progress voice sessions** (~1.5h): In `createVoiceSession()`, check for an existing `voice_sessions` row with `status = 'in_progress'` for the profile before creating a new one. If found, return that session ID and seed the client's `historyRef` with the stored transcript. Users returning mid-session resume where they left off.

3. **Replace the matches stub with a transitional screen** (~1h): Replace "coming soon" copy with a confirmation screen ("Your profile is saved — we'll notify you when pathway analysis is ready") and a clear next step. This removes the false-ending experience without requiring the recommendation engine to exist.

4. **Add a text entry fallback on the voice page** (~1.5h): Below the orb, add a collapsible "Prefer to type?" link that reveals a simple `<textarea>`. On submit, the text is sent to `/api/voice/turn` as the `transcript`. No changes to the backend needed — the turn API already accepts text transcripts.

5. **Unblock non-English users in voice** (~30min): Add one line to the Claude system prompt: "If the user writes or speaks in French, respond in French throughout the conversation." The ElevenLabs model (`eleven_multilingual_v2`) already supports French with no config change.

6. **Fix design system violations on auth/review screens** (~1h): Replace `text-[28px]` in the login page with the correct token class; replace the raw card styles in the review screen with the `.card` class; remove `font-jakarta`/`font-dm-sans` from the matches stub.

7. **Surface distinct auth error messages** (~30min): Map specific Supabase auth error codes in the callback handler (expired OTP, invalid token, network failure) to distinct `?error=` query params and display differentiated messages on the login page.

---

## Proposed Architecture: Smart Onboarding Flow

### Design Principles Applied
- **Progressive disclosure**: four phases, each with a clear purpose and a natural stopping point.
- **Voice-first, form-fallback**: voice is default; every phase has a form equivalent.
- **Instant gratification**: at the end of Phase 2, show a partial CRS range estimate.
- **Trust signals**: every phase header explains why the questions are being asked.
- **Resumability**: each phase writes to the DB before advancing; `onboarding_step` tracks position.
- **Minimal re-asking**: data from auth (email, name from Google) pre-fills automatically.

---

### Proposed Step Sequence

#### Phase 1 — Who are you? (2–3 min)
**Purpose:** Establish identity, residence, and relationship status.  
**Modality:** Voice (with text fallback)  
**Fields collected:** `full_name`, `date_of_birth`, `nationality`, `current_country`, `marital_status`, `spouse_coming_to_canada`  
**Supabase writes:** `profiles.full_name`, `profiles.date_of_birth`, `profiles.nationality`, `profiles.current_country`, `profiles.marital_status`, `profiles.spouse_coming_to_canada`  
**Estimated time:** 2 min  
**Skip condition:** `full_name` pre-filled from Google OAuth; `date_of_birth` may already be on file.  

#### Phase 2 — Your language skills (3–4 min)
**Purpose:** Collect official language test results — the highest-value CRS factor after age.  
**Modality:** Hybrid (voice asks which test was taken; form collects four numeric CLB scores per language)  
**Fields collected:** `clb_reading`, `clb_writing`, `clb_speaking`, `clb_listening`, `language_test_type`, `language_test_date`, and optionally `nclc_*` / `second_lang_*`  
**Supabase writes:** All CLB columns, `language_test_type`, `language_test_date`  
**Estimated time:** 3 min  
**Skip condition:** None — language scores are mandatory for Express Entry.  
**Design note:** Show a CLB reference card inline so users can look up their score from their IELTS/CELPIP band.

#### Phase 3 — Education and work (3–4 min)
**Purpose:** Establish education credential and work experience detail needed for CRS and FSW eligibility.  
**Modality:** Voice  
**Fields collected:** `education_level` (CRS enum), `eca_obtained`, `canadian_work_years`, `foreign_work_years`, `canadian_work_recent`, `foreign_work_recent`, `noc_code`, `noc_teer_category`, `has_trade_certificate`, `canadian_education_years`  
**Supabase writes:** All above columns  
**Estimated time:** 3 min  
**Skip condition:** If `has_degree = false` skip ECA question.  
**Note:** NOC code lookup should be assisted (fuzzy search by job title) rather than requiring the user to know their NOC code.

#### Phase 4 — Your situation (2 min)
**Purpose:** Collect additional CRS factors and settlement readiness indicators.  
**Modality:** Voice  
**Fields collected:** `has_sibling_in_canada`, `has_provincial_nomination`, `has_canadian_job_offer`, `has_dependents`, `has_criminal_record`, `settlement_funds`, `intended_destination_province`  
**Supabase writes:** All above columns  
**Estimated time:** 2 min  
**Skip condition:** If `has_canadian_job_offer = false`, skip arranged employment details.

#### Phase 5 — Spouse details (conditional, 2 min)
**Purpose:** Collect spouse CRS factors (only shown if `spouse_coming_to_canada = true`).  
**Modality:** Voice  
**Fields collected:** `spouse_education_level`, `spouse_clb_reading/writing/speaking/listening`, `spouse_canadian_work_years`  
**Supabase writes:** All spouse columns  
**Estimated time:** 2 min  
**Skip condition:** Skipped entirely if `spouse_coming_to_canada = false` or `marital_status = 'single'`.

#### Review & CRS Estimate (1 min)
**Purpose:** User validates extracted data and sees a live CRS score estimate.  
**Modality:** Form  
**Fields shown:** All collected fields, grouped by phase, with edit-in-place.  
**Feature:** Display computed CRS score range with a breakdown (Core + Spouse + Skill Transferability + Additional).  
**CTA:** "These details look right — show me my pathways"  
**Supabase writes:** `profile_completeness_pct`, `incomplete_fields`, final status = `'complete'`

---

### `onboarding_step` Tracking

Add a new column `onboarding_step text` to `profiles`:

```sql
alter table public.profiles
  add column onboarding_step text default 'not_started';

-- Valid values:
-- 'not_started' | 'phase_1_complete' | 'phase_2_complete' |
-- 'phase_3_complete' | 'phase_4_complete' | 'phase_5_complete' | 'review' | 'complete'
```

Middleware and the onboarding entry page can read this to resume at the correct phase.

---

## Proposed Supabase Schema Additions

> These are proposals only — do not run without developer review and approval.

```sql
-- 1. Add date_of_birth (CRITICAL — needed for CRS age calculation)
alter table public.profiles
  add column date_of_birth date;

-- 2. Add language test metadata
alter table public.profiles
  add column language_test_type  text,
  -- values: ielts | celpip | tef | tcf | pte | other
  add column language_test_date  date;

-- 3. Add intended province for PNP matching
alter table public.profiles
  add column intended_destination_province text;
  -- values: AB | BC | MB | NB | NL | NS | NT | NU | ON | PE | QC | SK | YT

-- 4. Add settlement funds (CAD)
alter table public.profiles
  add column settlement_funds_cad int;

-- 5. Add onboarding_step for multi-phase resume
alter table public.profiles
  add column onboarding_step text default 'not_started';

alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step in (
    'not_started', 'phase_1_complete', 'phase_2_complete',
    'phase_3_complete', 'phase_4_complete', 'phase_5_complete',
    'review', 'complete'
  ));

-- 6. Add language test type constraint
alter table public.profiles
  add constraint profiles_language_test_type_check
  check (language_test_type in ('ielts', 'celpip', 'tef', 'tcf', 'pte', 'other'));
```

---

## Proposed CRS Calculator Architecture

### Location
`src/lib/crs.ts` — pure TypeScript, no I/O, fully testable.

### TypeScript Interface

```typescript
// Input: drawn from the profiles row after onboarding is complete
export interface CrsInput {
  // Core — Personal
  dateOfBirth: Date;
  educationLevel: EducationLevel;
  clb: { reading: number; writing: number; speaking: number; listening: number };
  secondLang?: { reading: number; writing: number; speaking: number; listening: number };
  canadianWorkYears: 0 | 1 | 2 | 3 | 4 | 5;   // 5 = 5+
  foreignWorkYears: 0 | 1 | 2 | 3;              // 3 = 3+
  hasTradesCertificate: boolean;
  canadianEducationYears: 0 | 1 | 2 | 3;        // 3 = 3+
  ecaObtained: boolean;

  // Spouse (only when spouse is accompanying)
  spouseAccompanying: boolean;
  spouse?: {
    educationLevel: EducationLevel;
    clb: { reading: number; writing: number; speaking: number; listening: number };
    canadianWorkYears: 0 | 1 | 2 | 3 | 4 | 5;
  };

  // Additional points
  hasSiblingInCanada: boolean;
  hasProvincialNomination: boolean;
  jobOffer?: { teerCategory: 0 | 1 | 2 | 3; isLmiaExempt: boolean };
  frenchClb?: { reading: number; writing: number; speaking: number; listening: number };
}

export interface CrsBreakdown {
  coreA: number;           // Section A: Core human capital without spouse
  coreB: number;           // Section B: Spouse/partner factors
  skillTransferability: number;
  additional: number;
  total: number;
}

export type EducationLevel =
  | 'less_than_secondary'
  | 'secondary'
  | 'one_year_post_secondary'
  | 'two_year_post_secondary'
  | 'bachelors'
  | 'two_or_more_credentials'
  | 'masters'
  | 'phd';
```

### Key Branching Logic

```
computeCrs(input: CrsInput): CrsBreakdown
  ├── if spouse.accompanying
  │     Section A = age(with_spouse) + education(with_spouse) + language1(with_spouse) + canadianWork(with_spouse)
  │     Section B = spouse_education + spouse_language + spouse_canadianWork
  └── else
        Section A = age(without_spouse) + education(without_spouse) + language1(without_spouse) + canadianWork(without_spouse)
        Section B = 0

  Skill Transferability (max 100)
  ├── education + language CLB 7+  → up to 50 pts
  ├── education + canadianWork     → up to 50 pts
  ├── foreignWork + language CLB 7+→ up to 50 pts
  ├── foreignWork + canadianWork   → up to 50 pts
  └── certificate + language CLB 5+→ up to 50 pts

  Additional Points
  ├── Provincial nomination        → +600
  ├── Job offer TEER 0             → +200
  ├── Job offer TEER 1/2/3         → +50
  ├── Canadian study (2+ years)    → +15
  ├── French CLB 7+ (EN CLB 4+)   → +50
  ├── French CLB 7+ (no EN req)   → +25
  └── Sibling in Canada           → +15
```

### Integration Point

The CRS score should be computed **on the review screen** (Phase 5 / Review), after all fields are confirmed. Call `computeCrs(profileToCrsInput(profile))` server-side in the review page server component and pass the `CrsBreakdown` as a prop to the review client. Display the total score prominently and the breakdown in a collapsible section. Recompute on every field edit (debounced, client-side with the same pure function).

---

## Files to Create / Modify

| Action | File Path | Priority | Notes |
|---|---|---|---|
| CREATE | `src/lib/crs.ts` | P0 | Pure CRS calculator — no DB access |
| CREATE | `src/lib/crs.test.ts` | P0 | Test all scoring branches with IRCC sample scores |
| CREATE | `supabase/migrations/YYYYMMDD_add_missing_crs_fields.sql` | P0 | `date_of_birth`, `language_test_type`, `language_test_date`, `intended_destination_province`, `settlement_funds_cad`, `onboarding_step` |
| MODIFY | `src/modules/voice/service.ts` (CLAUDE_SYSTEM_PROMPT) | P0 | Add Phase 1 fields including `date_of_birth`; split into multi-phase prompts |
| MODIFY | `src/modules/voice/types.ts` | P0 | Add `date_of_birth` to `VoiceExtractedProfile` |
| REPLACE | `src/app/onboarding/matches/page.tsx` | P0 | Replace stub with real matches or a meaningful holding screen |
| CREATE | `src/app/onboarding/phase-2/page.tsx` | P1 | CLB score collection (hybrid voice + form) |
| CREATE | `src/app/onboarding/phase-3/page.tsx` | P1 | Education + work detail |
| CREATE | `src/app/onboarding/phase-4/page.tsx` | P1 | Situation + settlement factors |
| MODIFY | `src/app/onboarding/review/review-client.tsx` | P1 | Add CRS score display; expose expanded CRS fields |
| CREATE | `src/modules/pathways/service.ts` | P1 | Pathway matching logic (CRS threshold + program rules) |
| CREATE | `src/lib/i18n.ts` | P1 | EN/FR string map; `useT()` hook |
| MODIFY | `src/app/onboarding/voice/voice-client.tsx` | P1 | Add text fallback (`<textarea>` option) |
| MODIFY | `src/modules/voice/service.ts` (createVoiceSession) | P1 | Resume logic: check for orphaned `in_progress` session |
| CREATE | `src/app/page.tsx` | P2 | Real marketing/landing page with CTA |
| MODIFY | `src/app/auth/login/page.tsx` | P2 | Trust copy, fix `text-[28px]` design violation |
| MODIFY | `src/app/auth/callback/route.ts` | P2 | Differentiated error codes to login page |
| MODIFY | `src/app/onboarding/review/review-client.tsx` | P2 | Input validation (non-negative numbers, required fields) |
| MODIFY | `middleware.ts` | P2 | Update onboarding gate to support multi-phase `onboarding_step` |
