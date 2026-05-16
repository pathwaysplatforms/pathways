# specs/auth-module.md

## What to build
Complete authentication system using Supabase Auth.
Magic link is primary. Google OAuth is secondary.
No password inputs anywhere — never generate them.

## Pages to create

### /auth/login
- Clean centered layout, no sidebar, no nav
- Pathways wordmark at top
- Single email input with label "Email address"
- Primary button: "Continue with email" → triggers magic link
- Divider: "or"
- Secondary button: "Continue with Google" → triggers OAuth
- Supporting text below email button: "We'll send you a secure sign-in link"
- Follow specs/design-system.md exactly for all styling
- Follow specs/copy-and-tone.md for all copy

### /auth/callback/route.ts
- Handles code exchange for both magic link and Google OAuth flows
- On success:
  - Fetch profile for the authenticated user
  - If onboarding_status = 'not_started' → redirect to /onboarding
  - If onboarding_status = 'voice_complete' → redirect to /onboarding/review
  - If onboarding_status = 'complete' → redirect to /dashboard
- On error → redirect to /auth/login?error=auth

## Middleware (middleware.ts in project root)
Protect all routes except /auth/* and /api/auth/*

Logic:
- No session → redirect to /auth/login
- Has session + onboarding_status = 'not_started' → redirect to /onboarding
  (unless already on /onboarding/*)
- Has session + onboarding_status = 'voice_complete' → allow /onboarding/* only
- Has session + onboarding_status = 'complete' → allow all protected routes
- is_admin = false attempting /admin/* → redirect to /dashboard

Use the server Supabase client from src/lib/supabase/server.ts.
Never use the browser client in middleware.

## Auth helper functions (src/modules/auth/service.ts)

```typescript
// Get current session — returns null if not authenticated
getSession(): Promise<Session | null>

// Get full profile for current user — returns null if not found
getProfile(): Promise<Profile | null>

// Throws AuthError if no session
requireAuth(): Promise<User>

// Throws AuthError if not admin
requireAdmin(): Promise<User>

// Trigger magic link email
signInWithEmail(email: string): Promise<void>

// Trigger Google OAuth redirect
signInWithGoogle(): Promise<void>

// Clear session and redirect to /auth/login
signOut(): Promise<void>
```

## Types (src/modules/auth/types.ts)
Export these types derived from the database types:
- Profile: the profiles table row type
- Session: from Supabase auth
- AuthError: from src/lib/errors.ts

## Database interaction
Profile is auto-created by the trigger in migration 004_profiles.sql.
The trigger extracts full_name from raw_user_meta_data for Google OAuth.
The auth module never manually inserts into profiles.
Only reads profiles using the server client with the user's session.
Admin checks use the admin client (src/lib/supabase/admin.ts) server-side only.

## Error handling
All auth errors must use AuthError from src/lib/errors.ts.
Never expose raw Supabase error messages to the client.
Login page shows a generic message if error param is present in URL:
"We could not sign you in. Please try again."

## Logging
Every auth action must be logged with the request logger:
- signInWithEmail: log { action: 'auth.magic_link_requested', email }
- signInWithGoogle: log { action: 'auth.google_oauth_initiated' }
- signOut: log { action: 'auth.signed_out', userId }
- requireAuth failure: log { action: 'auth.unauthorized_access', path }

## Tests to write

### Unit tests (src/modules/auth/__tests__/service.test.ts)
- getSession returns null when no session exists
- getSession returns session object when authenticated
- signInWithEmail calls supabase.auth.signInWithOtp with correct params
- signInWithEmail throws ValidationError if email is invalid format
- requireAuth throws AuthError when session is null
- requireAdmin throws AuthError when is_admin is false
- requireAdmin returns user when is_admin is true

### Integration tests (tests/integration/auth.test.ts)
- New user signup via magic link creates a profile row automatically
- Profile row has correct auth_user_id matching the auth user
- Profile starts with onboarding_status = 'not_started'
- Unauthenticated request to a protected route returns redirect to /auth/login
- Authenticated user with complete onboarding can access /dashboard

## Definition of done
- npx tsc --noEmit passes with zero errors
- npm run test:unit passes
- npm run test:integration passes
- Visiting http://localhost:3000 redirects to /auth/login
- Login page renders correctly with email input and Google button
- Submitting an email triggers a magic link
  (check http://127.0.0.1:54324 — Inbucket catches all local emails)
- Clicking the magic link creates a session and redirects to /onboarding
- Visiting /dashboard without a session redirects to /auth/login
- Visiting /admin without is_admin = true redirects to /dashboard