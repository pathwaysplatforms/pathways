# AGENTS.md — Claude Code agent operating instructions

## Before starting any task
1. Read CLAUDE.md in full
2. Read the relevant spec file in /specs/ for the current task:
   - Any dashboard work → read specs/dashboard.md
   - Any UI work → read specs/design-system.md AND specs/copy-and-tone.md
   - Any auth work → read specs/auth-module.md
   - Any database work → read specs/database-schema.md AND src/types/database.ts
   - Any pathway/AI work → read specs/pathway-engine.md and specs/ai-features.md
3. Read the ## Design System section of CLAUDE.md before building any UI component
4. Read specs/copy-and-tone.md before writing any user-facing text
5. Check existing code in the module you're working near — match its patterns
6. Run npx tsc --noEmit to confirm the project currently compiles.
   If it does not compile before you start, stop and report the errors.

## Design System

Before building any UI component or screen, read ALL of these in order:
1. `specs/design-system.md` — visual direction, color tokens, typography, component rules
2. `specs/dashboard.md` — dashboard layout, all 4 states, card-by-card content spec
3. `tailwind.config.ts` — all design tokens as Tailwind classes
4. `src/app/globals.css` — component classes (.card, .card-accent, .btn-primary, .sidebar, etc.)
5. `src/lib/design-tokens.ts` — TypeScript token constants for programmatic use
6. `specs/copy-and-tone.md` — all user-facing text must follow this

Never invent colors, fonts, radii, or spacing. All values exist in the files above.
Never use Inter, Roboto, or system fonts — Urbanist only.
Never use Tailwind shadow utilities on cards — use only the .card class from globals.css.
If a conflict exists between CLAUDE.md CSS rules and globals.css (e.g. font-weight),
flag it to the developer rather than resolving it silently.

## How to handle uncertainty
- If a spec is ambiguous, stop and ask — do not guess and implement
- If implementing a feature requires a new database table not in the schema,
  stop and describe what you need — do not create migrations unilaterally
- If a spec references a database column that does not exist (e.g. crs_score,
  profile_expiry_date, medical_exam_date), use the fallback behaviour described
  in specs/dashboard.md — do NOT add a migration. Flag the gap to the developer
  at the end of the session as instructed in the spec.
- If you need a new npm package, stop and ask first
- If a task would require modifying an existing migration file, stop and ask
- If you find a bug in code outside your current task, flag it but do not fix
  it unless asked
- If globals.css or tailwind.config.ts tokens appear to conflict with CLAUDE.md
  CSS rules, flag the conflict to the developer rather than picking one silently

## File creation rules
- New modules: /src/modules/[name]/service.ts, types.ts, index.ts
- New API routes: /src/app/api/[route]/route.ts
- New pages: /src/app/[route]/page.tsx
- New components: /src/components/[feature]/ComponentName.tsx
- Module unit tests: /src/modules/[name]/__tests__/service.test.ts
- Integration tests: /tests/integration/[name].test.ts
- E2E tests: /tests/e2e/[name].spec.ts
- Never create files outside these locations without asking

## After completing any task
1. Run npx tsc --noEmit — must show zero errors
2. Run npm run test:unit — all tests must pass
3. Run npm run lint — must show zero warnings
4. Report exactly what you built, what tests you wrote, and any
   decisions you made that were not specified in the spec
5. Flag anything that requires manual action (env vars, Supabase
   dashboard config, API keys needed, etc.)
6. Flag all schema gaps encountered during the build — list each missing
   column/table and what fallback behaviour was used

## Test writing requirements
After implementing any function, immediately write tests for it.

Unit tests:
- Every exported function gets at least 3 tests: happy path, edge case,
  error case
- Mock all external APIs using vi.mock() — no real network calls
- Tests must not depend on each other — each is fully self-contained
- Use descriptive names: "returns empty array when no pathways match profile"
  not "test 1"

Integration tests (any function that queries Supabase):
- Use the local Supabase instance — no mocking the database
- Always clean up test data in afterEach
- Test RLS policies explicitly: attempt operations as unauthenticated user
  and as a different user, verify access is denied

## Code quality non-negotiables
- Every exported function has a JSDoc comment (one line minimum)
- Every function that can fail has error handling
- No console.log — use the logger from /src/lib/logger.ts
- No TODO comments — implement fully or flag the gap
- No commented-out code
- No any types without a comment explaining why
- No type assertions (as SomeType) without a comment explaining why

## What this agent must never do
- Modify files in /supabase/migrations/ that already exist
- Add npm packages without approval
- Create database tables not in /specs/database-schema.md
- Add database columns to work around schema gaps — use specified fallbacks
  and flag the gap instead
- Write UI that uses colours, spacing, or fonts outside the design system
- Implement password-based authentication
- Use console.log instead of the logger
- Commit, push, or switch git branches
- Run supabase db push
- Leave placeholder or TODO implementations
- Resolve conflicts between spec files silently — flag them to the developer