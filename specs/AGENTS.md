# AGENTS.md — Claude Code agent operating instructions

## Before starting any task
1. Read CLAUDE.md in full
2. Read the relevant spec file in /specs/ for the current task
3. Read specs/design-system.md before writing any UI component
4. Read specs/copy-and-tone.md before writing any user-facing text
5. Check existing code in the module you're working near — match its patterns
6. Run npx tsc --noEmit to confirm the project currently compiles
   If it does not compile before you start, stop and report the errors

## How to handle uncertainty
- If a spec is ambiguous, stop and ask — do not guess and implement
- If implementing a feature requires a new database table not in the schema,
  stop and describe what you need — do not create migrations unilaterally
- If you need a new npm package, stop and ask first
- If a task would require modifying an existing migration file, stop and ask
- If you find a bug in code outside your current task, flag it but do not fix
  it unless asked

## File creation rules
- New modules: /src/modules/[name]/service.ts, types.ts, index.ts
- New API routes: /src/app/api/[route]/route.ts
- New pages: /src/app/[route]/page.tsx
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
- Write UI that uses colours, spacing, or fonts outside the design system
- Implement password-based authentication
- Use console.log instead of the logger
- Commit, push, or switch git branches
- Run supabase db push
- Leave placeholder or TODO implementations