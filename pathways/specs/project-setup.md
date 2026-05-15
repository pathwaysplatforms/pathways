# Task: project setup

## What to build
Scaffold the complete Pathways Next.js project with all infrastructure in place.
Do NOT build any features. Only setup.

## Steps to complete in order

### 1. Next.js project
- Next.js 14 with App Router
- TypeScript strict mode (tsconfig: strict: true, noImplicitAny: true)
- Tailwind CSS
- ESLint + Prettier configured

### 2. Dependencies to install
- @supabase/supabase-js @supabase/ssr
- pino pino-pretty (logging)
- zod (validation)
- vitest @vitest/ui happy-dom (unit/integration testing)
- @playwright/test (E2E testing)
- openai (for embeddings + TTS)

### Sentry setup (include in session 1)
Install: @sentry/nextjs
Run: npx @sentry/wizard@latest -i nextjs
This creates sentry.client.config.ts and sentry.server.config.ts automatically.
Add SENTRY_DSN to .env.example and .env.local (get from sentry.io free project).
Do not configure any Sentry features beyond basic error capture for now.

### 3. Environment setup
Create .env.example with every variable documented:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- DEEPGRAM_API_KEY
- LOG_LEVEL (default: info)

### 4. Logger (src/lib/logger.ts)
Pino logger with:
- JSON output in production
- Pretty output in development
- Base fields: service='pathways-api', env, version
- Export: logger and a createRequestLogger(correlationId) function

### 5. Error classes (src/lib/errors.ts)
Typed error hierarchy:
- PathwaysError (base): code, message, statusCode, context
- ValidationError extends PathwaysError (400)
- AuthError extends PathwaysError (401)
- NotFoundError extends PathwaysError (404)
- DatabaseError extends PathwaysError (500)

### 6. Supabase client (src/lib/supabase/)
- client.ts: browser client
- server.ts: server component client (uses cookies)
- admin.ts: service role client (server only, never exposed to browser)
- types.ts: placeholder for generated database types

### 7. Vitest config (vitest.config.ts)
- environment: happy-dom
- setupFiles: tests/setup.ts
- coverage enabled

### 8. Playwright config (playwright.config.ts)
- baseURL: http://localhost:3000
- chromium only for now

### 9. GitHub Actions (.github/workflows/ci.yml)
Trigger: push to main and develop, all PRs
Steps:
- Install deps
- Type check (tsc --noEmit)
- Lint
- Unit tests (vitest run)
- Build check (next build)

### 10. Folder structure
Create all folders from the structure in CLAUDE.md including empty index files
so the structure is visible in git.

## Tests to write alongside setup
- tests/unit/logger.test.ts: verify logger outputs correct JSON fields
- tests/unit/errors.test.ts: verify each error class has correct statusCode

### Additional setup tasks for session 1

Create .github/workflows/ci.yml with the full CI pipeline as specified in 
the development guide. Use npm run test:unit and npm run test:integration 
as the test commands.

Create vitest.config.ts and vitest.integration.config.ts as specified.

Create tests/setup.ts with mock reset and console.error suppression.

Create tests/integration/setup.ts:
- Import createClient from @supabase/supabase-js
- Export a testSupabase client pointing at process.env.SUPABASE_URL
  (which will be the local instance in CI and locally)
- Export a helper: cleanupTestData(table, condition) that deletes test 
  rows after each integration test

Add all scripts to package.json as specified.

After completing setup, run:
  npm run typecheck   → must pass
  npm run test:unit   → must pass (only setup tests exist at this point)
  npm run lint        → must pass
Report the results.

## Definition of done
- `npx tsc --noEmit` passes with zero errors
- `npx vitest run` passes
- `npx next build` succeeds
- All folders exist as defined in CLAUDE.md