# Auth & Data Security Audit

## 1. Supabase Tables — Operations & RLS Status

| Table | Operations | RLS Status |
|---|---|---|
| `profiles` | SELECT, UPDATE | Enabled (migrations) |
| `voice_sessions` | SELECT, INSERT, UPDATE | Enabled |
| `applications` | SELECT, INSERT, DELETE | Enabled |
| `application_documents` | (RLS policies only — no direct app queries) | Enabled |
| `application_step_completions` | SELECT, UPSERT | Enabled |
| `user_documents` | SELECT, INSERT, UPDATE, DELETE | Enabled |
| `pathways` | SELECT | Enabled |
| `pathway_steps` | SELECT | Enabled |
| `pathway_categories` | (RLS policies only) | Enabled |
| `pathway_progress` | SELECT, UPSERT | Enabled |
| `pathway_matches` | SELECT, INSERT | Enabled |
| `pathway_documents` | SELECT, UPSERT (seed script only) | Enabled |
| `document_requirements` | SELECT | Enabled |
| `countries` | SELECT | Enabled |
| `guest_sessions` | SELECT, INSERT, UPDATE | Enabled |
| `posts` | SELECT, INSERT, UPDATE, DELETE | Enabled — **see ISSUE RLS-1** |
| `audit_log` | (trigger-only writes) | Enabled |
| `immigration_chunks` | SELECT (via RPC) | Enabled |
| `immigration_sources` | (RPC join only) | Enabled |
| `immigration_draws` | SELECT | Enabled |
| `step_checklist_progress` | SELECT, UPSERT | Enabled |

All tables have RLS enabled via migrations. No table was found without RLS.

---

## 2. Row Level Security Issues

### RLS-1 — Posts admin policy uses user-controlled JWT metadata
- **File:** `supabase/migrations/20260614000001_posts_table.sql`, lines 46–51
- **Risk:** **High**
- **Description:** The admin write policy for `posts` evaluates `auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'`. The `user_metadata` field is writable by any authenticated user via `supabase.auth.updateUser()` — it is not server-controlled. Any authenticated user can set `user_metadata.role = "admin"` in the browser and immediately gain full INSERT/UPDATE/DELETE access to the `posts` table, bypassing the application-level `requireAdmin()` check entirely.
- **Fix:** Replace the policy condition with a subquery against the server-controlled `profiles` table: `auth.uid() IN (SELECT auth_user_id FROM public.profiles WHERE is_admin = true)`. Alternatively use `app_metadata` (which only the service role can write): `(auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true`.

---

## 3. Service Role Client Misuse

The service role client (`src/lib/supabase/admin.ts`) bypasses all RLS policies. Its use should be reserved for cross-user or system-level operations. The following cases use the admin client where the anon-key server client would suffice.

### SRM-1 — `pathway_matches` read uses admin client
- **File:** `src/lib/pathway-matcher.ts`, line ~752 (`getCachedMatch`)
- **Risk:** Medium
- **Description:** `getCachedMatch` uses the admin client to SELECT from `pathway_matches`. The table has a correct per-user RLS read policy. The admin client is justified for the INSERT in `matchPathways` but not for the read.
- **Fix:** Pass the authenticated server client to `getCachedMatch`. Retain the admin client only for the insert.

### SRM-2 — Self-profile updates use admin client
- **Files:** `src/app/api/onboarding/confirm/route.ts`, `src/app/api/onboarding/profile/route.ts`, `src/app/api/onboarding/reset/route.ts`, `src/modules/voice/service.ts`
- **Risk:** Low
- **Description:** These routes use the admin client to UPDATE the authenticated user's own `profiles` row. RLS already permits users to update their own profile. Using the admin client here is unnecessary and expands the blast radius if the admin key were ever leaked.
- **Fix:** Replace `createSupabaseAdminClient()` with the server client for these self-owned updates.

---

## 4. API Routes Without Auth Checks Before DB/AI Operations

### AUTH-1 — `PATCH /api/guest/[token]` — no auth, admin client, writes to guest_sessions
- **File:** `src/app/api/guest/[token]/route.ts`
- **Risk:** High (see also DATA-1 below — the two issues compound)
- **Description:** This route accepts a token in the URL and performs an UPDATE on `guest_sessions` using the admin client — no `getUser()` call, no session check. The only gate is knowing the UUID token. The token is stored in `localStorage` and passed in URL parameters, so it may appear in logs or be accessible via XSS.
- **Fix:** This is intentional for the unauthenticated guest flow. Mitigate by: (a) fixing the schema weakness (DATA-1), (b) adding per-IP rate limiting, and (c) ensuring tokens are short-lived or invalidated after migration.

### AUTH-2 — `POST /api/guest/match` — no auth, calls Claude Sonnet + OpenAI embeddings
- **File:** `src/app/api/guest/match/route.ts`
- **Risk:** High
- **Description:** Triggers the full pathway matching pipeline (OpenAI embedding + Claude Sonnet, 4096 max_tokens) with no authentication and no rate limiting. Any caller who creates a free guest session can trigger unlimited expensive AI calls.
- **Fix:** Add per-IP rate limiting. Enforce 1 match result per guest token at the route level (the service has a cache check but it can be bypassed by hitting the endpoint multiple times before the first response is saved).

### AUTH-3 — `POST /api/voice/guest-turn` — no auth, calls Claude Haiku + ElevenLabs TTS per turn
- **File:** `src/app/api/voice/guest-turn/route.ts`
- **Risk:** High
- **Description:** Called once per voice conversation turn. Triggers Claude Haiku + ElevenLabs TTS with no authentication and no rate limiting. The `sessionId` field is validated as a non-empty string but is never verified against the `guest_sessions` table — any UUID string is accepted.
- **Fix:** Verify `sessionId` exists in `guest_sessions` before processing. Add per-session turn cap (e.g., 25 turns) and per-IP rate limiting.

### AUTH-4 — `POST /api/guest/session` and `GET /api/voice/guest-session` — public admin writes
- **Files:** `src/app/api/guest/session/route.ts`, `src/app/api/voice/guest-session/route.ts`
- **Risk:** Medium
- **Description:** Both routes create `guest_sessions` rows using the admin client with no auth and no rate limiting. A bot can create an unbounded number of rows, growing the table indefinitely.
- **Fix:** Add per-IP rate limiting on session creation (e.g., 10 sessions per IP per hour).

---

## 5. Cross-User Data Exposure

### DATA-1 — Guest session migration spreads unvalidated fields into `profiles` (CRITICAL)
- **File:** `src/modules/guest/service.ts`, lines 126–130 (`migrateGuestSession`)
- **Risk:** **Critical**
- **Description:** `migrateGuestSession` copies the entire `guest_sessions.onboarding_data` JSON object into the `profiles` row via `db.from('profiles').update(fields)`. Because `onboarding_data` is stored as `z.record(z.unknown())` (see AUTH-1), an attacker can poison their own guest session with any column name — including `is_admin: true`, `subscription_status: 'pro'`, `auth_user_id: '<other-user-uuid>'`. The update is executed with the admin client, which bypasses RLS. This is a privilege escalation path to admin.
- **Fix:** Apply an explicit allowlist before calling `update()`:
  ```ts
  const ALLOWED_PROFILE_FIELDS = ['nationality', 'current_country', 'target_country', 'education_level', /* ... */];
  const safeFields = Object.fromEntries(
    Object.entries(onboardingData).filter(([k]) => ALLOWED_PROFILE_FIELDS.includes(k))
  );
  await db.from('profiles').update(safeFields).eq('id', profileId);
  ```

### DATA-2 — Guest session PATCH accepts arbitrary onboarding_data keys
- **File:** `src/app/api/guest/[token]/route.ts`, line ~36
- **Risk:** High
- **Description:** `PatchSchema` uses `onboarding_data: z.record(z.unknown())`. An attacker can write any key/value pair into `onboarding_data`, which is later consumed by `migrateGuestSession` (DATA-1). Even if DATA-1 is fixed with an allowlist, the permissive schema means guest sessions can accumulate arbitrary junk data.
- **Fix:** Replace `z.record(z.unknown())` with a strict Zod schema mirroring `VoiceExtractedProfileSchema` — only permit the defined profile fields.

---

## 6. Middleware Auth Gating

### MW-1 — Middleware uses `getSession()` instead of `getUser()`
- **File:** `middleware.ts`, line ~75
- **Risk:** Medium
- **Description:** `supabase.auth.getSession()` reads the session from the cookie without verifying the JWT signature server-side. Supabase's own docs recommend `getUser()` for server-side authentication checks because it validates the token against the Supabase auth server. A crafted or replayed cookie could pass the session check in middleware without being a valid active session.
- **Fix:** Replace `supabase.auth.getSession()` with `supabase.auth.getUser()` in `middleware.ts`. This adds one network round-trip but is cryptographically sound. All individual API routes already use `getUser()` correctly — this aligns middleware to the same standard.

---

## 7. Environment Variables

No AI API keys (Anthropic, OpenAI, ElevenLabs, Deepgram) were found with a `NEXT_PUBLIC_` prefix. `SUPABASE_SECRET_KEY` has no `NEXT_PUBLIC_` prefix. No hardcoded secrets were found in source code.

Full env var inventory:

| Variable | Prefix | Exposure | Assessment |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | NEXT_PUBLIC | Browser | Correct — URL is always public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | NEXT_PUBLIC | Browser | Correct — anon key is designed to be public |
| `SUPABASE_SECRET_KEY` | (none) | Server only | Correct |
| `ANTHROPIC_API_KEY` | (none) | Server only | Correct |
| `OPENAI_API_KEY` | (none) | Server only | Correct |
| `ELEVENLABS_API_KEY` | (none) | Server only | Correct |
| `ELEVENLABS_VOICE_ID` | (none) | Server only | Correct |
| `GLADIA_API_KEY` | (none) | Server only | Correct |
| `ADMIN_SECRET` | (none) | Server only | Correct |
| `NEXT_PUBLIC_DEMO_ENABLED` | NEXT_PUBLIC | Browser | Acceptable — boolean flag, no secret value |
| `NEXT_PUBLIC_MARKETING_URL` | NEXT_PUBLIC | Browser | Acceptable — URL only |

---

## 8. Missing Security Headers

### HDR-1 — No HTTP security headers configured
- **File:** `next.config.mjs`
- **Risk:** Medium
- **Description:** No Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or HSTS headers are set anywhere. Without these, the app is vulnerable to clickjacking, MIME-sniffing attacks, and does not enforce HTTPS at the HTTP layer.
- **Fix:** Add a `headers()` export to `next.config.mjs`:
  ```js
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
      ],
    }];
  }
  ```

### HDR-2 — Auth callback constructs `http://` redirect URLs
- **Files:** `src/app/auth/callback/route.ts` line ~19, `src/app/api/demo/set-state/route.ts` line ~189
- **Risk:** Medium
- **Description:** Redirect URLs are constructed with the `Host` header but no protocol detection. Behind a TLS-terminating load balancer or CDN, this produces `http://` redirect URLs, which browsers may block as mixed content and which can downgrade secure magic-link callbacks.
- **Fix:** Use `request.nextUrl.origin` (preserves the detected protocol) or check `request.headers.get('x-forwarded-proto')` to construct the correct scheme.
