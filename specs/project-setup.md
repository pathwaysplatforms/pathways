# Task: project setup

## What to build
Scaffold the complete Pathways Next.js project with all infrastructure in place.
Do NOT build any features. Only setup.

## Steps to complete in order

### 1. Next.js project
- Next.js 14 with App Router
- TypeScript strict mode (tsconfig: strict: true, noImplicitAny: true)
- Tailwind CSS v4
- ESLint + Prettier configured

### 2. Dependencies to install
- @supabase/supabase-js @supabase/ssr
- pino pino-pretty
- zod
- vitest @vitest/ui happy-dom @vitest/coverage-v8
- @playwright/test
- openai
- @anthropic-ai/sdk
- @sentry/nextjs
- pino

### 3. Environment variables
All config via environment variables. Names to use throughout:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- DEEPGRAM_API_KEY
- SENTRY_DSN
- LOG_LEVEL (default: info)

### 4. Logger (src/lib/logger.ts)
Pino logger with:
- JSON output in production, pretty output in development
- Base fields: service='pathways', env, version
- Export: logger and createRequestLogger(correlationId) function
- Export type: RequestLogger

### 5. Error classes (src/lib/errors.ts)
Typed error hierarchy:
- PathwaysError (base): code, message, statusCode, context
- ValidationError extends PathwaysError (400)
- AuthError extends PathwaysError (401)
- NotFoundError extends PathwaysError (404)
- DatabaseError extends PathwaysError (500)

### 6. Supabase clients (src/lib/supabase/)
- client.ts: browser client using NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- server.ts: server component client using cookies
- admin.ts: service role client using SUPABASE_SECRET_KEY (server only)
- types.ts: placeholder export for generated database types

### 7. Vitest config (vitest.config.ts)
- environment: happy-dom
- globals: true
- setupFiles: tests/setup.ts
- include: src/**/*.test.ts and src/**/*.test.tsx
- coverage provider: v8

### 8. Vitest integration config (vitest.integration.config.ts)
- environment: node
- include: tests/integration/**/*.test.ts
- testTimeout: 30000
- hookTimeout: 30000

### 9. Package.json scripts
"typecheck": "tsc --noEmit"
"lint": "eslint . --max-warnings 0"
"test:unit": "vitest run"
"test:integration": "vitest run --config vitest.integration.config.ts"
"test:all": "vitest run && vitest run --config vitest.integration.config.ts"
"test:watch": "vitest"
"test:coverage": "vitest run --coverage"
"test:e2e": "playwright test"

### 10. Playwright config (playwright.config.ts)
- baseURL: http://localhost:3000
- chromium only for now
- testDir: tests/e2e

### 11. Tests setup file (tests/setup.ts)
- afterEach: vi.clearAllMocks()
- vi.spyOn console.error to suppress in tests

### 12. Integration tests setup (tests/integration/setup.ts)
- Export supabase test client pointing at local instance
- Export cleanupTestData(table, condition) helper

### 13. GitHub Actions (.github/workflows/ci.yml)
Trigger: push to main and develop, all pull_requests
Environment variables:
  NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
Steps:
  1. actions/checkout@v4
  2. actions/setup-node@v4 node 20
  3. npm ci
  4. npm run typecheck
  5. npm run lint
  6. npm run test:unit
  7. supabase/setup-cli@v1
  8. supabase start
  9. npm run test:integration
  10. npm run build

### 14. Folder structure to create
src/
  lib/
    supabase/
  modules/
    auth/
    voice/
    pathways/
    documents/
    ai/
  app/
    auth/
      login/
      callback/
    onboarding/
      voice/
      review/
      matches/
    dashboard/
    pathways/
    applications/
    admin/
  types/
  components/
    ui/
tests/
  unit/
  integration/
  e2e/
specs/
supabase/
  migrations/

### 15. Sentry setup
Install @sentry/nextjs
Create sentry.client.config.ts and sentry.server.config.ts
Basic error capture only, no additional features

## Tests to write alongside setup
- src/lib/__tests__/logger.test.ts: verify logger outputs correct fields
- src/lib/__tests__/errors.test.ts: verify each error class has correct
  statusCode and code field

## Definition of done
- npx tsc --noEmit passes with zero errors
- npm run test:unit passes
- npm run lint passes
- npm run build succeeds
- All folders exist as defined above
- Output the contents of .env.example so developer can verify all
  variables are documented