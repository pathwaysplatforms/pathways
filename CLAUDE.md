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
- No arbitrary Tailwind values except where the relevant spec explicitly permits
  them (e.g. outer dashboard padding p-[28px]).
- Never create a database migration without stopping and proposing it first.
  Some schema gaps exist (crs_score, profile_expiry_date, etc.) — use the
  fallback behaviour described in specs/dashboard.md rather than adding columns
  unilaterally.

## Design System

Before building any UI component or screen, read ALL of these in order:
1. `specs/design-system.md` — visual direction, color tokens, typography, component rules
2. `specs/dashboard.md` — dashboard layout, all 4 states, card-by-card content spec
3. `tailwind.config.ts` — all design tokens as Tailwind classes
4. `src/app/globals.css` — component classes (.card, .card-accent, .btn-primary, .sidebar, etc.)
5. `src/lib/design-tokens.ts` — TypeScript token constants for programmatic use
6. `specs/copy-and-tone.md` — all user-facing text must follow this

Never invent colors, fonts, radii, or spacing. All values exist in the files above.
Never use Inter, Roboto, or system fonts — Urbanist only (loaded via next/font/google).
Never use Tailwind shadow utilities on cards — use only the .card class shadow from globals.css.
Never use font-weight 600 (font-semibold) or 700 (font-bold) except where explicitly
permitted in the relevant spec. If a conflict exists between this rule and globals.css,
flag it to the developer rather than resolving it silently.

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
- Schema is the source of truth. See /specs/database-schema.md and src/types/database.ts.
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
Methods: magic link (primary), Google OAuth (secondary), email+password (guest signup only)
Session: cookie-based via @supabase/ssr — never use localStorage for tokens
Password inputs: allowed only in the guest signup modal (SaveResultsModal). Always use
supabase.auth.signUp — never store, hash, or handle passwords manually.

Admin check: server-side only, using the service role client.
Pattern: const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('is_admin')
  .eq('auth_user_id', user.id)
  .single()
Never check is_admin on the client side.

Stack: Next.js 14 App Router, Tailwind CSS v4, shadcn/ui (slate base),
Radix UI, Framer Motion (purposeful only), Lucide React, Lottie React
(voice waveform only).

Rules:
- No arbitrary Tailwind values (no text-[17px], no p-[13px]) except where
  a spec file explicitly permits a specific value
- No inline styles except where Tailwind cannot achieve it
- No colours outside the token set in specs/design-system.md
- No font-weight 600 or 700 (flag conflict with globals.css to developer)
- No box shadows on cards — use only the .card class from globals.css
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

## Dependencies
Adding reasonable, well-maintained npm packages is authorized without asking first,
provided they are: actively maintained, widely used, appropriately licensed
(MIT/Apache/BSD or similar), and a good fit for the task. Prefer a small, focused
dependency over reinventing non-trivial logic (e.g. rate limiting, validation,
date handling). Still flag — and ask before adding — anything that is heavy,
unmaintained, security-sensitive at the native level, or that meaningfully
overlaps with something already in package.json. Always record the new dependency
in package.json (no global-only installs) and note why it was added.

## What Claude Code must never do
- Use any type or type assertions without explaining why
- Create database tables not in /specs/database-schema.md
- Modify existing migration files
- Run supabase db push
- Commit or push code
- Switch git branches
- Write password inputs or password-based auth
- Use console.log instead of the logger
- Leave TODO comments or placeholder implementations
- Write UI that violates the design system
- Add database columns to work around schema gaps — flag them instead