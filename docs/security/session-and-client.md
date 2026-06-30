# Session & Client-Side Security Audit

## 1. localStorage Usage

All `localStorage` references in the codebase:

| File | Key | Value Stored | Sensitive? |
|---|---|---|---|
| `src/lib/guest-session.ts:11` | `pathways_guest_token` | UUID guest session token | **Yes** — grants read/write access to guest session data including name, DOB, nationality |
| `src/components/dev/DevToolbar.tsx` | `pw_dev_toolbar_open` | Boolean (toolbar visibility) | No |

No auth tokens, Supabase JWTs, or profile data are stored in `localStorage`. Supabase auth tokens are managed via cookies by `@supabase/ssr`, which is correct.

### SESS-1 — Guest session token stored in `localStorage`
- **File:** `src/lib/guest-session.ts`, lines 11 and 17
- **Risk:** Medium
- **Description:** The guest token (`pathways_guest_token`) is a UUID that grants anyone who holds it the ability to: (a) read the full `onboarding_data` for the session including personal details (name, date of birth, nationality, employment history), (b) trigger pathway matching that consumes AI budget (see rate-limiting.md RL-AI-2), and (c) migrate that session's data into any account via `POST /api/auth/migrate-guest`. Storing this in `localStorage` means it is accessible to any JavaScript executing on the page — a successful XSS attack (or a compromised third-party script) could silently exfiltrate it. `localStorage` also persists indefinitely across page loads and browser restarts.
- **Fix:** Move to `sessionStorage` (auto-clears on tab close, still JS-accessible but limits persistence), or use a short-lived `httpOnly` cookie (JS-inaccessible). If `sessionStorage` is chosen, ensure the guest token is read and passed correctly through the OAuth redirect flow since `sessionStorage` does not persist across redirects to external URLs (the Google OAuth popup/redirect would clear it).

### SESS-2 — Guest token not cleared after Google OAuth path
- **File:** `src/components/results/SaveResultsModal.tsx`, line ~57
- **Risk:** Low
- **Description:** `clearGuestToken()` is called in the email signup path (`if (data.session)` branch). In the Google OAuth path, the user is redirected to `/auth/callback?guest_token=<UUID>` and migration is handled in the callback route — but `clearGuestToken()` is never explicitly called client-side after the redirect returns. The token persists in `localStorage` until the user lands on a component that explicitly clears it (if any).
- **Fix:** Call `clearGuestToken()` in the post-OAuth landing page (e.g., the dashboard welcome or the auth callback client-side redirect target). Alternatively, treat token clearance as part of the `/auth/callback` response by setting a short-lived cookie that triggers the clear on the client.

---

## 2. Session Token Handling

### Supabase auth tokens — cookie assessment
Supabase `@supabase/ssr` stores the session in cookies named `sb-<ref>-auth-token`. These are set by the server client in the auth callback route. Assessment:

| Property | Status | Notes |
|---|---|---|
| `httpOnly` | Set by `@supabase/ssr` | The library sets httpOnly by default — JS cannot read the JWT |
| `Secure` | Set by `@supabase/ssr` | Sent only over HTTPS in production |
| `SameSite` | Set to `Lax` by `@supabase/ssr` | Correct — allows redirect-based OAuth flows |
| Stored in localStorage | **No** | Correct — `@supabase/ssr` uses cookies only |

Supabase session cookie handling is correct. No issues found.

### SESS-3 — Guest token passed as URL query parameter
- **Files:** `src/app/auth/callback/route.ts` (~line 25), `src/components/results/SaveResultsModal.tsx` (magic link `emailRedirectTo`)
- **Risk:** Medium
- **Description:** The guest token is appended to the auth callback URL: `/auth/callback?guest_token=<UUID>`. This means the UUID:
  1. Appears in the browser address bar during the redirect
  2. Is recorded in server access logs (Vercel logs, Supabase logs)
  3. May be transmitted in `Referer` headers to third-party scripts
  4. Appears in browser history
  While the token itself has limited permissions (it cannot be used to compromise other users), exposure in logs creates a permanent record that could enable session replay or data access if logs are compromised.
- **Fix:** Avoid passing the token in the URL. Options: (a) store the token in `sessionStorage` before initiating the OAuth redirect — note that `sessionStorage` is cleared during redirect, so write it back with a state parameter, or (b) use the Supabase `state` parameter in the OAuth flow to embed the token, then read it back in the callback. Option (b) is the cleanest approach for OAuth flows.

### SESS-4 — Middleware uses `getSession()` not `getUser()`
- **File:** `middleware.ts`, ~line 75
- **Risk:** Medium
- **Description:** (Cross-referenced from auth-and-data.md MW-1.) `getSession()` reads the session from the cookie without making a network call to validate the JWT signature. A forged or replayed cookie could pass the middleware gate. All individual route handlers use `getUser()` correctly, but the middleware route-level gating is weaker.
- **Fix:** Replace `supabase.auth.getSession()` with `supabase.auth.getUser()` in `middleware.ts`.

---

## 3. Input Validation — Forms to Database

All API routes were audited for Zod validation before DB writes.

| Route | Zod Validation | Schema Strictness | Assessment |
|---|---|---|---|
| `POST /api/onboarding/profile` | Yes — `VoiceExtractedProfileSchema.partial()` | Strict field types | SECURE |
| `POST /api/onboarding/confirm` | Yes — `ConfirmSchema` | Strict | SECURE |
| `POST /api/onboarding/reset` | No body | N/A | SECURE |
| `PATCH /api/guest/[token]` | Yes — `PatchSchema` | **Weak** — `onboarding_data: z.record(z.unknown())` | **See INP-1** |
| `POST /api/guest/session` | No body | N/A | SECURE |
| `POST /api/guest/match` | Yes | Strict | SECURE |
| `POST /api/pathways/match` | None (GET params only) | N/A | SECURE |
| `POST /api/pathways/select` | Yes | Strict | SECURE |
| `POST /api/vault/upload` | Partial — doc_type only via Zod | Missing filename sanitisation | **See INP-2** |
| `PATCH /api/vault/files/[id]` | Yes | Strict | SECURE |
| `POST /api/ask` | Yes — question bounded to 2000 chars | Strict | SECURE |
| `POST /api/cover-letter/generate` | Yes | Strict | SECURE |
| `POST /api/voice/turn` | Yes | Strict | SECURE |
| `POST /api/voice/guest-turn` | Yes | Strict | SECURE |
| `POST /api/auth/migrate-guest` | Yes | Strict | SECURE |

### INP-1 — Guest PATCH schema accepts arbitrary key/value pairs
- **File:** `src/app/api/guest/[token]/route.ts`
- **Risk:** High (compounds with auth-and-data.md DATA-1)
- **Description:** `PatchSchema` allows `onboarding_data: z.record(z.unknown())` — any JSON object. No field allowlist is enforced at the validation layer. Combined with the `migrateGuestSession` function that spreads these fields into `profiles`, this is the input vector for the critical privilege escalation issue.
- **Fix:** Define `onboarding_data` in `PatchSchema` as a strict Zod object matching `VoiceExtractedProfileSchema` — only permit known profile fields with their correct types. Reject any extra keys with `.strict()`.

### INP-2 — Document upload filename not sanitised
- **File:** `src/app/api/vault/upload/route.ts`
- **Risk:** Low
- **Description:** The uploaded filename is stored in Supabase Storage and used as the display name in the vault. The route validates `document_type` via Zod but does not sanitise the filename. A user could upload a file named `<script>alert(1)</script>.pdf`. Since the filename is displayed in the vault UI using React (which escapes by default), there is no immediate XSS risk. However, the unsanitised filename is stored in the database and could cause issues if ever rendered via a different codepath or in admin views.
- **Fix:** Strip or encode special characters from filenames before storage: `filename.replace(/[^a-zA-Z0-9._\- ]/g, '_')`. Low priority given React's escaping.

---

## 4. Client-Side Data Exposure

### No `dangerouslySetInnerHTML` found
A full codebase search found no uses of `dangerouslySetInnerHTML`. All user-supplied content is rendered through React's default escaping. SECURE.

### Client-side data fetching — large table assessment

| Data | Fetched | Filtered | Assessment |
|---|---|---|---|
| Dashboard data | Server (page.tsx) | In SQL query | SECURE |
| Application steps | Server (page.tsx) | In SQL query, scoped to user | SECURE |
| Vault documents | Server (page.tsx) | In SQL query, scoped to user | SECURE |
| Profile sections | Server (page.tsx) | In SQL query, scoped to user | SECURE |
| Immigration draws | Client (`DrawsClient.tsx`) | Server-side query with LIMIT | SECURE |
| Pathways list | Server | SQL query | SECURE |
| Step checklist progress | Client (`ApplicationPageClient.tsx`) | Filtered by `user_id` + `step_id` in query | SECURE |

No instances found where a full table is fetched client-side and filtered in the browser. All user-specific data is filtered at the Supabase query level. SECURE.

### SESS-5 — Checklist progress fetched with untyped cast in client component
- **File:** `src/components/dashboard/ApplicationPageClient.tsx`, `AccordionChecklist` component
- **Risk:** Low
- **Description:** The `step_checklist_progress` Supabase query uses `as unknown as` casts to work around the typed client returning `never`. This is the documented pattern for this codebase (see memory), but it means TypeScript cannot catch incorrect column names or unexpected shapes. If the table schema changes, runtime errors will occur silently.
- **Fix:** Generate updated types via `supabase gen types typescript --local > src/types/database.ts` after any migration to keep the types in sync.

---

## 5. Summary of Session & Client Issues

| ID | File | Risk | Issue |
|---|---|---|---|
| SESS-1 | `src/lib/guest-session.ts` | Medium | Guest token in localStorage |
| SESS-2 | `src/components/results/SaveResultsModal.tsx` | Low | Token not cleared after Google OAuth |
| SESS-3 | `src/app/auth/callback/route.ts` | Medium | Guest token in URL params / server logs |
| SESS-4 | `middleware.ts` | Medium | `getSession()` instead of `getUser()` |
| INP-1 | `src/app/api/guest/[token]/route.ts` | High | Arbitrary keys accepted in guest PATCH schema |
| INP-2 | `src/app/api/vault/upload/route.ts` | Low | Filename not sanitised before storage |
