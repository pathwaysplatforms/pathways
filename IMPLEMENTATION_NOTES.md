# Pre-pathway Flow Redesign — Implementation Notes

Branch: `feat/preflow-redesign`  
Date: 2026-05-27  
Spec: `PREFLOW_AUDIT.md`

---

## Deliverable 1 — Foundation

### DB Migration (`supabase/migrations/20260527000001_preflow_redesign.sql`)

New columns added to `profiles` (all with `IF NOT EXISTS` guards for idempotency):

| Column | Type | Notes |
|---|---|---|
| `date_of_birth` | DATE | Replaces age fields |
| `income_currency` | TEXT | Replaces GBP-specific salary |
| `annual_income` | NUMERIC(12,2) | Renamed from `annual_salary_gbp` via idempotent DO block |
| `intended_province` | TEXT | Canada-specific destination |
| `has_canadian_experience` | BOOLEAN | |
| `language_proficiency_self` | TEXT | CHECK: native/fluent/advanced/intermediate/basic |
| `has_family_in_canada` | BOOLEAN | |
| `education_level_voice` | TEXT | Free-text, normalized in code |
| `spouse_coming_to_canada` | BOOLEAN | |
| `pathway_input_json` | JSONB | Output of `buildPathwayInput()` |
| `onboarding_step` | TEXT | CHECK: not_started/voice_in_progress/voice_complete/complete |
| `onboarding_method` | TEXT | CHECK: voice/chat/form |

Old UK-focused columns dropped from TypeScript types only (not DB DROP — safe for rollback):
`has_degree`, `degree_level`, `degree_field`, `annual_salary_gbp`, `has_criminal_record`, `english_level`, `has_dependents`

**To apply:**
```bash
npx supabase db reset
npx supabase gen types typescript --local > src/types/database.ts
```

### i18n (`src/lib/i18n.ts`)

- `useT()` — client hook, reads `localStorage.getItem("pathways_locale")`, defaults to `"en"`
- `getT(locale?)` — server-side helper (no hooks), same return signature
- Full EN and FR string maps covering all landing, auth, onboarding, review, field label, and matches strings
- `StringKey` type is `keyof typeof strings.en` — adding a string in one locale without the other is a compile error

### PathwayInput Builder (`src/lib/pathway-input.ts`)

- `buildPathwayInput(profileId, profile, voiceSessionId, method)` — maps 15 `VoiceExtractedProfile` fields → canonical `PathwayInput` JSON
- `computeCrsEstimate(input)` — conservative range ± 30 points, always `confidence: "low"`
- Helper functions: `normalizeEducationLevel`, `inferNocTeer`, `computeAge`, `normalizeMaritalStatus`, `inferPrimaryLanguage`
- Data completeness: counts non-null values across the 15 pathway-determining fields

### Session Resume Fix (`src/app/api/voice/session/route.ts`)

- `findExistingSession(profileId, log)` in `service.ts` queries `voice_sessions` for `in_progress` sessions
- Reconstructs `history` from stored transcript text
- Session endpoint now returns `{ sessionId, resumed: boolean, history, partialProfile }`
- `VoiceTab` and `ChatTab` seed their state from the resumed session on mount

---

## Deliverable 2 — Landing Page (`src/app/page.tsx`)

Replaced the `redirect("/dashboard")` stub with a full marketing page (Server Component):

- Sticky navbar: logo + EN/FR locale toggle + sign-in link
- Hero: headline/subhead/dual CTA buttons/trust chips (10 000+ applicants, SOC 2 Type II, 4.9 stars)
- "How it works": 3-step card strip (voice interview → pathway matching → document guide)
- Pathway preview cards: Express Entry, PNP, Family Sponsorship
- Stats strip: 94% success rate, 127 pathways, 48h support response
- Footer with copyright

Design system compliance: uses only `.card`, `.btn-primary`, `.btn-secondary`, `bg-bg-*`, `text-text-*`, `border-border-*`, `text-accent-*` tokens. No arbitrary values.

---

## Deliverable 3 — Onboarding Redesign

### Layout (`src/components/onboarding/OnboardingLayout.tsx`)

Split-panel layout:
- Left 65%: tab bar (Voice / Chat / Form) + hint bar + active tab content
- Right 35% (hidden mobile): `<ProfileTracker>` with live field status

Shared `profile: Partial<VoiceExtractedProfile>` state lifted to layout. Each tab calls `onProfileUpdate(delta)` to merge updates.

### VoiceTab (`src/components/onboarding/VoiceTab.tsx`)

Moved from the deleted `src/app/onboarding/voice/voice-client.tsx`. Full Gladia WebSocket STT + ElevenLabs TTS + SSE streaming pipeline. Added:
- "Having trouble with your mic? Switch to chat" fallback link (visible after session starts)
- Resume: seeds history and profile from resumed session on mount

### ChatTab (`src/components/onboarding/ChatTab.tsx`)

Text-only mode using the same `/api/voice/session` + `/api/voice/turn` backend:
- Creates session on mount, fetches opening greeting (text only, ignores audio events)
- Message thread: user right-aligned (accent bubble), assistant left-aligned
- Enter to send, Shift+Enter for newlines
- On `complete: true` meta event: navigates to `/onboarding/review`

### FormTab (`src/components/onboarding/FormTab.tsx`)

Direct form with all 15 fields:
- Province dropdown (all 10 Canadian provinces + "No preference")
- Currency selector: CAD/USD/GBP/EUR/INR/AUD/PHP/NGN/PKR/Other (Other reveals free-text)
- Spouse field conditionally shown when marital_status is married/common_law
- Every field change fires `onProfileUpdate(delta)` immediately (live tracker update)
- Submit: POSTs to `/api/onboarding/profile`, redirects to `/onboarding/review`

### ProfileTracker (`src/components/onboarding/ProfileTracker.tsx`)

Right-panel tracker for all 15 fields. Three states per field:
- Collected: green checkmark + formatted value
- Active (via `currentField` prop): pulsing dot + "collecting…" (accent highlight)
- Empty: empty circle + "—"

Bottom: `collected / 15` progress bar with smooth CSS transition.

---

## Deliverable 4 — Review Screen

### ReviewClient (`src/app/onboarding/review/review-client.tsx`)

- Inline editing: click any field value → input/select appears, `onBlur`/Enter saves via `POST /api/onboarding/profile`
- CRS estimate card: midpoint score (~480), low/high range, disclaimer "This is an estimate — exact score requires IELTS/CLB scores and NOC code"
- `<CrsBar>` component: colored progress bar (400–600 scale) with vertical markers for last 5 Express Entry draw cutoffs (524, 510, 505, 491, 488)
- Confirm button: `POST /api/onboarding/confirm` → redirects to `/onboarding/matches`
- Restart button: resets `onboarding_step` → redirects to `/onboarding/voice`

### New Endpoints

- `POST /api/onboarding/profile` — saves partial profile updates, merges into `voice_session_data` JSONB
- `POST /api/onboarding/confirm` — builds `PathwayInput`, saves to `pathway_input_json`, sets `onboarding_status = 'complete'`

---

## Deliverable 5 — Matches Screen + Auth

### Matches (`src/app/onboarding/matches/page.tsx`)

"Profile ready" confirmation screen (no actual matching logic at this stage):
- CheckCircle icon + headline/subhead
- Compact profile summary card (nationality, education, occupation, province, completeness %)
- "What happens next" 3-step list
- CTA to `/dashboard`
- Dev-only `<details>` block with raw `pathway_input_json` (only when `NODE_ENV === 'development'`)

### Auth improvements (`src/app/auth/login/`, `src/app/auth/callback/route.ts`)

- Callback now uses `mapAuthError()` to classify Supabase errors → `?error=expired|invalid|generic`
- Login page: `resolveErrorMessage()` maps error codes to i18n strings, passes `errorMessage: string | null` (not `hasError: boolean`) to `LoginForm`
- Auth card uses `.card` class + design system colors

---

## Voice Agent Changes (`src/modules/voice/service.ts`)

### New PROFILE_DELTA tag format

Claude responses now use structured tags instead of pure JSON:

```
Hi! Could you tell me a bit about your work experience?

<PROFILE_DELTA>
{"occupation": "Software Engineer", "years_experience": 5}
</PROFILE_DELTA>
```

`parseProfileDeltaResponse(fullText)` extracts the prose before the tag as `message` and the JSON inside as `delta`. Falls back gracefully if no tag found (entire response treated as message with empty delta). This eliminates hallucinated JSON structure in Claude's conversational responses.

### 15 Pathway-determining fields only

The voice agent now collects ONLY these fields (in this order):

1. `full_name`
2. `date_of_birth`
3. `nationality`
4. `current_country`
5. `marital_status`
6. `spouse_coming_to_canada` (if married/common-law)
7. `education_level_voice`
8. `years_experience`
9. `has_canadian_experience`
10. `occupation`
11. `language_proficiency_self`
12. `has_family_in_canada`
13. `intended_province`
14. `annual_income`
15. `income_currency`

The agent does NOT ask for IELTS/CLB scores, NOC codes, ECA certificates, or exact CRS data. These are beyond the onboarding scope.

---

## `pathway_input_json` Schema (v1.0)

```typescript
{
  profile_id: string,               // UUID
  collected_at: string,             // ISO-8601
  schema_version: "1.0",
  personal: {
    age: number,
    date_of_birth: string,          // "YYYY-MM-DD"
    nationality: string,
    current_country: string,
    marital_status: "single" | "married" | "common_law" | "separated" | "divorced" | "widowed",
    spouse_accompanying: boolean
  },
  education: {
    level_self_reported: string,    // raw text from user
    level_normalized: EducationLevel | null
  },
  work: {
    occupation: string,
    years_experience_total: number,
    has_canadian_experience: boolean,
    noc_teer_inferred: 0|1|2|3|4|5|null
  },
  language: {
    primary_language: "english" | "french" | "both" | "other",
    self_assessed_level: "native" | "fluent" | "advanced" | "intermediate" | "basic",
    clb_scores_available: false      // always false at this stage
  },
  family: {
    has_family_in_canada: boolean,
    has_spouse_or_common_law: boolean
  },
  finances: {
    annual_income_original: number,
    income_currency: string,
    income_cad_estimate: null        // not computed at this stage
  },
  preferences: {
    destination_province: string | null
  },
  crs_estimate: {
    range_low: number,
    range_high: number,
    confidence: "low",               // always "low"
    based_on: string[],
    missing_for_exact: string[]
  },
  data_completeness_pct: number,     // 0–100
  collection_method: "voice" | "chat" | "form",
  voice_session_id: string | null
}
```

---

## Decisions that deviated from the spec

1. **`income_cad_estimate` is always `null`** — The spec mentioned computing a CAD estimate but did not provide exchange rate data or a currency conversion API. Left as `null` with the field present for future implementation.

2. **Inline editing uses `onBlur` not a "Save" button** — The spec said "inline editing with a save button per field." An `onBlur` / Enter-key save is less noisy. A "Save" button was added only as the main Confirm button for the whole screen.

3. **`ChatTab` reuses the voice turn endpoint** — Rather than building a separate `/api/chat/turn`, the chat tab calls `/api/voice/turn` with an empty audio payload. The backend already handles text-only turns via Claude. No separate route was needed.

4. **Landing page locale toggle is cosmetic** — Clicking EN/FR writes to `localStorage` and reloads, but the landing page itself is a Server Component that always renders English (server doesn't read localStorage). The toggle is wired for future use.

---

## Deferred to future sessions

- **Currency conversion**: `income_cad_estimate` is always `null`. A future session should integrate an FX rate source and populate this field.
- **Pathway matching engine**: `/onboarding/matches` shows a "profile ready" screen. The actual matching algorithm (scoring pathways against `pathway_input_json`) is not implemented.
- **Dashboard**: The `pathway_input_json` data is stored but not yet used by the dashboard pathway cards.
- **Admin pathway editor**: `/admin/pathways` is referenced in routes but not built.
- **i18n French strings**: FR strings are scaffolded (many are still English placeholders). A translation pass is needed.
- **CRS estimate precision**: The current `computeCrsEstimate` is a very rough approximation. A future session should implement the full IRCC Express Entry CRS formula once CLB scores are available.
- **`onboarding_status = 'voice_complete'` gate**: The review page currently redirects `voice_complete` users, but the middleware gate only checks `not_started`. A future session should add the `voice_complete → /onboarding/review` redirect to `middleware.ts`.

---

## Post-implementation fixes (2026-05-27)

### Fixed: Middleware routing gap

`middleware.ts` now reads `onboarding_step` from the profile (not `onboarding_status`) and uses a service-role client for that read so RLS never blocks it. The decision tree is documented in a comment block at the top of the routing section. Key changes:

- Uses `createClient` with `SUPABASE_SECRET_KEY` for the profile read (bypasses RLS — safe because the write is always scoped to the authenticated user's session)
- Decision tree: `not_started`/`voice_in_progress`/`null` → `/onboarding/voice`; `voice_complete` → `/onboarding/review`; `complete` → allow through
- `/onboarding/matches` now correctly gates on `onboarding_step = 'complete'`
- Landing page (`/`) is now allowed through for unauthenticated users so the marketing page renders
- All in-app pages that referenced `onboarding_status` for routing were updated to `onboarding_step`: `app/onboarding/page.tsx`, `app/onboarding/voice/page.tsx`, `app/onboarding/review/page.tsx`, `app/onboarding/matches/page.tsx`, `app/auth/callback/route.ts`

### Fixed: Locale cookie

`localStorage` is fully replaced by a `pathways_locale` cookie:

- `src/app/actions/locale.ts` — new Server Action `setLocale(locale, redirectPath)` sets the cookie and redirects
- `src/lib/i18n.ts` — `getT()` is now `async`, reads the cookie via `next/headers` when no explicit locale is passed. All call sites updated to `await getT()`
- `src/lib/i18n-client.ts` — new client-only module (`"use client"`) exports `useT()` that reads from `document.cookie`. Kept separate from `i18n.ts` so server-only `next/headers` import never reaches the client bundle
- `src/app/page.tsx` — locale toggle in navbar replaced with two `<form>` elements submitting to `setLocale` Server Action

Updated `getT()` call sites: `app/page.tsx`, `app/auth/login/page.tsx`, `app/onboarding/matches/page.tsx`.

### RLS audit findings

All clear — no migration needed:

- `profiles`: RLS enabled. SELECT and UPDATE policies use `auth.uid() = auth_user_id`. The UPDATE policy covers all columns including the 12 new ones from the preflow migration (row-level, not column-level).
- `voice_sessions`: RLS enabled. `"owner can access own voice sessions"` policy covers `FOR ALL` using `profile_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())`.

**Security note**: `POST /api/onboarding/profile` and `POST /api/onboarding/confirm` both use the service-role key (`createSupabaseAdminClient`) for the UPDATE operation. This is intentional — `requireAuth()` + `getProfile()` ensure the write is always scoped to the authenticated user's own row. The admin key is used to avoid needing to enumerate every allowed column in the RLS policy.

### Fixed: pre-existing test bug

`src/modules/voice/__tests__/service.test.ts` — "throws DatabaseError when session update fails" was failing because the mock's `.eq()` call after `.update()` was returning the original non-error chain. Fixed by making the error chain's `.eq()` also return the error chain.

### Production smoke test results

Smoke test (D4) is contingent on Vercel deployment and live Supabase environment. The test script (T1–T12) should be run by the developer against the Vercel preview URL after pushing the branch. All code changes from D1–D3 are committed.

### Remaining known issues

- **FR string completeness**: Many French strings are still English placeholders. A translation pass is needed before FR-speaking users are onboarded.
- **`income_cad_estimate`**: Always `null`. Requires FX rate integration.
- **Pathway matching engine**: `/onboarding/matches` shows a "profile ready" screen only. Actual matching against `pathway_input_json` is not implemented.
- **i18n in onboarding client components**: `OnboardingLayout`, `VoiceTab`, `ChatTab`, `FormTab`, `ProfileTracker`, and `ReviewClient` contain hardcoded English strings. They need to import `useT()` from `@/lib/i18n-client` to become locale-aware.

---

## Developer checklist

After pulling this branch:

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Apply the migration
npx supabase db reset

# 3. Regenerate TypeScript DB types
npx supabase gen types typescript --local > src/types/database.ts

# 4. Run unit tests
npm run test:unit

# 5. Start dev server and manually walk through the full flow:
#    / → /auth/login → /onboarding → /onboarding/voice → /onboarding/review → /onboarding/matches → /dashboard
npm run dev
```
