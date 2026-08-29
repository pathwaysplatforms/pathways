# Application Page DB Wiring + Age Scoring
## Two focused tasks for `feat/pathway-matcher` branch

---

## Task 1: Wire Real DB Fetch in `/applications/[applicationId]`

### Context

`src/app/applications/[applicationId]/page.tsx` currently always serves
`mockApplication` regardless of the `applicationId` param. The mock is
useful for UI dev but the page needs to serve real data when a real
`applicationId` is present, and fall back to mock only when
`?mock=true` is in the URL.

### What to build

**`page.tsx` logic:**

```typescript
// If ?mock=true → serve mockApplication (keep existing behaviour)
// Otherwise → query DB using params.applicationId

// Queries needed:
// 1. applications row — verify it exists and belongs to current user
// 2. pathways row — get title, slug, official_name via application.pathway_id
// 3. pathway_steps rows — ordered by step_number for this pathway
// 4. document_requirements rows — for each step of type 'document_upload'
// 5. application_documents rows — any already-uploaded docs for this application
```

**Data shape to produce** (must match what `ApplicationLayout` already expects):

Map DB rows → the same `MockApplication` shape defined in
`src/modules/pathways/mock-application.ts`. This means:

- Each `pathway_steps` row becomes a `Step` object
- `step.status` is derived:
  - If a matching `application_documents` row exists with `status = 'uploaded'`
    or `status = 'verified'` → `'completed'`
  - The first non-completed step → `'current'`
  - All steps after the current step → `'upcoming'`
- `step.document` is populated from `document_requirements` where
  `pathway_id` matches and `document_type` matches the step's type

**Add a new service function** in `src/modules/pathways/service.ts`:

```typescript
export async function getApplicationData(
  applicationId: string,
  profileId: string
): Promise<ApplicationData | null>
```

- Returns `null` if application not found or doesn't belong to `profileId`
- Throws `DatabaseError` on unexpected DB errors
- Exported type `ApplicationData` should be added to `types.ts`

**`page.tsx` structure:**

```typescript
export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: { applicationId: string }
  searchParams: { mock?: string }
}) {
  // 1. If mock=true, return <ApplicationLayout application={mockApplication} />

  // 2. Get current user profile
  const profile = await getProfile()
  if (!profile) redirect('/auth/login')

  // 3. Fetch real application data
  const application = await getApplicationData(params.applicationId, profile.id)
  if (!application) notFound()

  // 4. Render with real data
  return <ApplicationLayout application={application} />
}
```

### Step type mapping from DB

The `pathway_steps` table has `title` and `description` but no `type` column.
Infer step type from the step title or add a `type` column. **Preferred
approach: add a `type` column to `pathway_steps`.**

Run this migration in Supabase SQL editor AND save as a migration file:

```sql
-- supabase/migrations/20260528000002_pathway_steps_type.sql

alter table public.pathway_steps
  add column if not exists type text not null default 'external_action';

-- Update Express Entry FSW steps
update public.pathway_steps ps
set type = 'information'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
  and ps.step_number = 1;

update public.pathway_steps ps
set type = 'document_upload'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
  and ps.step_number in (2, 3, 4, 5);

update public.pathway_steps ps
set type = 'review'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-fsw')
  and ps.step_number = 8;

-- Update Express Entry CEC steps
update public.pathway_steps ps
set type = 'document_upload'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
  and ps.step_number in (2, 3, 4);

update public.pathway_steps ps
set type = 'review'
where ps.pathway_id = (select id from public.pathways where slug = 'express-entry-cec')
  and ps.step_number = 7;
```

### Error states to handle

- `applicationId` not found → `notFound()` (renders 404)
- `applicationId` belongs to different user → `notFound()` (don't leak existence)
- No steps seeded for pathway → render application layout with empty steps array
  and a banner: "Application steps are being set up. Check back shortly."

---

## Task 2: Add Age to Profiles + CRS Age Scoring

### Context

Age contributes up to 110 CRS points for applicants aged 18–35. The
`calculateCRS()` function currently skips this entirely and has a JSDoc
warning. This is a meaningful gap — a 28-year-old with CLB 9 and a
bachelor's degree is missing ~110 pts from their calculated score, which
directly affects ITA likelihood display.

### Migration

```sql
-- supabase/migrations/20260528000003_profiles_date_of_birth.sql

alter table public.profiles
  add column if not exists date_of_birth date;
```

Save this file locally AND run it in Supabase SQL editor.

No CHECK constraint needed — null is valid for existing profiles.

### Voice agent change

In `CLAUDE_SYSTEM_PROMPT` in `src/modules/voice/service.ts`:

Add `date_of_birth` to the fields list:
```
- date_of_birth: their date of birth as a YYYY-MM-DD string.
  Ask naturally: "And what year were you born?" then derive the full
  date as YYYY-01-01 if only a year is given (precision is enough for
  CRS age scoring). If they give a full date, use it exactly.
```

Add to extraction rules:
```
- date_of_birth: output as ISO string "YYYY-MM-DD". "I was born in 1990"
  → "1990-01-01". "March 15, 1988" → "1988-03-15". Never output age
  as an integer — always a date string.
```

Add to `VoiceExtractedProfileSchema` in `types.ts`:
```typescript
date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
```

Add to `buildFinalProfile()`:
```typescript
date_of_birth: partial.date_of_birth ?? null,
```

Add to `finalizeVoiceSession()` profile update:
```typescript
date_of_birth: extractedProfile.date_of_birth,
```

### CRS age scoring update

In `src/modules/pathways/service.ts`, update `calculateCRS()`:

Add `date_of_birth: string | null` to `MatcherProfile` type in `types.ts`.

Add age scoring logic to `calculateCRS()`:

```typescript
// Age points (single applicant, no accompanying spouse)
// Source: IRCC CRS grid — these are the single-applicant values
function getAgePoints(dateOfBirth: string | null, hasSpouse: boolean): number {
  if (!dateOfBirth) return 0 // missing data — conservative

  const today = new Date()
  const dob = new Date(dateOfBirth)
  const age = today.getFullYear() - dob.getFullYear()
    - (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)

  if (hasSpouse) {
    // With accompanying spouse — lower max (100 pts at 18-35)
    if (age < 18 || age > 45) return 0
    if (age <= 35) return 100
    if (age === 36) return 95
    if (age === 37) return 90
    if (age === 38) return 85
    if (age === 39) return 80
    if (age === 40) return 75
    if (age === 41) return 70
    if (age === 42) return 65
    if (age === 43) return 60
    if (age === 44) return 55
    return 0
  } else {
    // Without accompanying spouse — max 110 pts
    if (age < 18 || age > 45) return 0
    if (age <= 35) return 110
    if (age === 36) return 105
    if (age === 37) return 99
    if (age === 38) return 94
    if (age === 39) return 88
    if (age === 40) return 83
    if (age === 41) return 77
    if (age === 42) return 72
    if (age === 43) return 66
    if (age === 44) return 61
    return 0
  }
}
```

Remove the JSDoc `@gap` warning for age once implemented.

Add `date_of_birth` to the `missing_data` array logic in `matchPathways()`
if it is null — same pattern as other nullable fields.

### Unit test updates

Add test cases to `src/modules/pathways/__tests__/service.test.ts`:

```typescript
// Age scoring
it('awards 110 pts for age 28, no spouse', ...)
it('awards 99 pts for age 37, no spouse', ...)
it('awards 0 pts for age 46', ...)
it('awards 0 pts when date_of_birth is null', ...)
it('awards 100 pts for age 28 with spouse', ...)

// Full CRS with age
it('calculates correct CRS for a complete profile including age', () => {
  // Software engineer, age 28, CLB 9 all abilities, bachelor's,
  // 3 yrs foreign experience, no Canadian experience, no bonuses
  // Expected: ~110 (age) + 112 (education) + 128 (language) + 0 (CA work) = 350
  // Note: still missing skill transferability (~50-100 pts)
  expect(calculateCRS(profile)).toBeGreaterThanOrEqual(340)
  expect(calculateCRS(profile)).toBeLessThanOrEqual(360)
})
```

---

## Implementation Order for Cursor

Do these in order — Task 1 first since it makes the application flow real:

1. Run the SQL for both migrations in Supabase SQL editor
2. Save migration files locally
3. Implement Task 1: `getApplicationData()` service function + update `page.tsx`
4. Test: create a real application via `/onboarding/matches`, then visit
   `/applications/[real-id]` — should show real steps, not mock
5. Implement Task 2: migration + voice agent change + `calculateCRS()` update
   + new unit tests
6. Verify all 18+ existing pathway tests still pass after the CRS change