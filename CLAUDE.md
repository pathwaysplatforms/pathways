# Pathways — Claude Code instructions

## Project overview
Immigration pathway platform. Users complete voice onboarding, get matched to
visa pathways, and manage their document checklist. Built with Next.js 14 App
Router, Supabase (Postgres + pgvector + Storage), TypeScript strict mode,
Tailwind CSS v4, shadcn/ui.

## Non-negotiable rules
- TypeScript strict mode always. No `any` types, ever.
- Every function that touches the database must have a unit test.
- Every API route must have an integration test.
- Never write business logic inside React components — it belongs in /src/modules.
- Never hardcode secrets. All config comes from environment variables.
- All user-facing errors must be caught and returned as structured JSON:
  `{ error: { code: string, message: string } }`
- Every server action and API route must log entry and exit with the logger.
- Use Zod to validate all external input before it touches the database.
- No console.log anywhere — use the logger from /src/lib/logger.ts.
- No TODO comments — implement fully or flag the gap to the user.
- No commented-out code.
- Every exported function has a JSDoc comment (one line minimum).

## Spec files are read-only
Never modify any file in the specs/ directory.
Specs are instructions for Claude, not outputs.
If a spec needs updating, flag it to the developer.

## Patterns to follow
- Module pattern: every feature lives in /src/modules/{name}/ with its own
  service.ts, types.ts, and __tests__/ directory.
- Database access: always go through /src/lib/supabase/client.ts,
  server.ts, or admin.ts. Never import Supabase client directly in
  components or routes.
- Error handling: throw typed errors from /src/lib/errors.ts, catch at the
  route boundary, log with correlationId.
- Every request gets a correlationId via createRequestLogger(correlationId).
  Pass this logger through to every function that does meaningful work.

## Environment variable names
Supabase uses the new key naming convention:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  (not ANON_KEY)
- SUPABASE_SECRET_KEY                   (not SERVICE_ROLE_KEY)
Never use the old names anywhere in the codebase.

## Database
- Schema is the source of truth. See /specs/database-schema.md.
- Never modify the schema by hand in Supabase dashboard. Always write a
  migration file in /supabase/migrations/.
- Row-level security is mandatory on every table. No exceptions.
- Never create new tables without proposing the migration and waiting
  for approval.
- Never modify /supabase/migrations/ files that already exist.
- After creating any migration run:
  supabase db reset
  supabase gen types typescript --local > src/types/database.ts

## Testing
- Unit tests: Vitest, in /src/modules/{name}/__tests__/
- Integration tests: Vitest, in /tests/integration/
- E2E tests: Playwright, in /tests/e2e/
- Every exported function gets at least 3 tests: happy path, edge case,
  error case.
- Mock all external APIs (OpenAI, Anthropic, Deepgram) in unit tests
  using vi.mock() — no real network calls in tests.
- Integration tests use the local Supabase instance — no mocking the DB.
- Run vitest run before finishing any session. All tests must pass.

## Routes and navigation

### URL structure
/                              → redirect: authed → /dashboard, unauthed → /auth/login
/auth/login                    → magic link entry + Google OAuth button
/auth/callback                 → Supabase auth callback — do not rename
/onboarding                    → step 1: intro screen
/onboarding/voice              → step 2: voice conversation interface
/onboarding/review             → step 3: review and confirm extracted profile
/onboarding/matches            → step 4: personalised pathway matches
/dashboard                     → returning user home — application cards + status
/pathways                      → browse all pathways with filters
/pathways/[slug]               → pathway detail: requirements, steps, documents
/applications/[id]             → application overview + step tracker
/applications/[id]/documents   → document checklist + upload interface
/admin                         → admin home (is_admin required)
/admin/pathways                → create/edit pathway records
/admin/pathways/[id]           → edit individual pathway
/admin/users                   → user management

### Onboarding gate (implement in middleware.ts)
Users with onboarding_status = 'not_started' redirected to /onboarding
from any protected route. Users with onboarding_status = 'voice_complete'
redirected to /onboarding/review. Middleware runs on all routes except
/auth/* and /api/auth/*.

### Navigation model
- Onboarding (/onboarding/*): no sidebar, no nav. Full-screen focused flow.
- App (/dashboard, /pathways, /applications/*): sidebar nav on desktop,
  bottom tab bar on mobile. Sidebar width 240px.
- Admin (/admin/*): separate sidebar with admin links only.
- Voice interface (/onboarding/voice): full-screen on all devices.

## Authentication
Provider: Supabase Auth
Methods: magic link (primary), Google OAuth (secondary)
Session: cookie-based via @supabase/ssr — never use localStorage for tokens
Password inputs: never generate them anywhere in the codebase

Admin check: server-side only, using the service role client.
Pattern: const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('is_admin')
  .eq('auth_user_id', user.id)
  .single()
Never check is_admin on the client side.

## UI and design system
Read specs/design-system.md before writing any UI component.
Read specs/copy-and-tone.md before writing any user-facing text.

Stack: Next.js 14 App Router, Tailwind CSS v4, shadcn/ui (slate base),
Radix UI, Framer Motion (purposeful only), Lucide React, Lottie React
(voice waveform only).

Rules:
- No arbitrary Tailwind values (no text-[17px], no p-[13px])
- No inline styles except where Tailwind cannot achieve it
- No colours outside the token set in design-system.md
- No font-weight 600 or 700
- No box shadows on cards
- No more than one primary button per screen
- No placeholder-only form fields — always add a visible label
- No lorem ipsum — use realistic immigration-context copy

## Git workflow
Branches:
- main: production only. Never commit directly.
- develop: integration branch. All feature branches merge here via PR.
- feat/[name]: one branch per module/session. Short-lived.

Claude Code never commits, pushes, switches branches, or runs
supabase db push. Those are always the developer's responsibility.

## What Claude Code must never do
- Use any type or type assertions without explaining why
- Install npm packages without asking first
- Create database tables not in /specs/database-schema.md
- Modify existing migration files
- Run supabase db push
- Commit or push code
- Switch git branches
- Write password inputs or password-based auth
- Use console.log instead of the logger
- Leave TODO comments or placeholder implementations
- Write UI that violates the design system