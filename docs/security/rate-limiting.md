# Rate Limiting Audit

## Finding: Zero Rate Limiting Exists

There is no rate limiting anywhere in the codebase — no Upstash, no Redis, no in-memory counter, no Vercel edge middleware throttling. Every endpoint, including all AI endpoints, can be called in an infinite tight loop by any caller.

---

## 1. AI Endpoints (Highest Priority)

### All AI endpoints — full inventory

| Route | Auth Required | Model | Max Tokens | Cost Per Call (est.) | Rate Limited? |
|---|---|---|---|---|---|
| `POST /api/voice/turn` | Yes | claude-haiku-4-5-20251001 + ElevenLabs TTS | 1024 | ~$0.02–0.08 | **No** |
| `POST /api/voice/guest-turn` | **No** | claude-haiku-4-5-20251001 + ElevenLabs TTS | 1024 | ~$0.02–0.08 | **No** |
| `POST /api/guest/match` | **No** | claude-sonnet-4-6 + OpenAI embeddings | 4096 | ~$0.05–0.15 | **No** |
| `POST /api/pathways/match` | Yes | claude-sonnet-4-6 + OpenAI embeddings | 4096 | ~$0.05–0.15 | **No** |
| `POST /api/ask` | Yes | claude-haiku-4-5-20251001 + OpenAI embeddings | 500 | ~$0.005 | **No** |
| `POST /api/cover-letter/generate` | Yes | claude-3-5-haiku-20241022 | 800 | ~$0.01 | **No** |
| `POST /api/admin/generate-post` | Yes (admin) | claude-haiku-4-5-20251001 | 2000 | ~$0.02 | **No** |
| `POST /api/admin/import-resource` | Yes (admin) | claude-haiku-4-5-20251001 | 500 | ~$0.005 | **No** |

### RL-AI-1 — `POST /api/voice/guest-turn` — unauthenticated, no rate limit, calls Claude + ElevenLabs per turn
- **File:** `src/app/api/voice/guest-turn/route.ts`
- **Risk:** **Critical**
- **Description:** An unauthenticated caller can trigger a Claude Haiku call + ElevenLabs TTS call per request with no auth, no session validation, and no rate limit. The `sessionId` field is validated as a non-empty string but never verified against `guest_sessions` — any UUID passes. A bot looping at 1 req/sec generates ~$170–700/day in AI costs alone.
- **Fix:** (1) Verify `sessionId` against `guest_sessions` table before any AI call. (2) Enforce a per-session turn cap (25 max). (3) Add per-IP rate limit: 50 requests per hour.

### RL-AI-2 — `POST /api/guest/match` — unauthenticated, no rate limit, calls Claude Sonnet + OpenAI
- **File:** `src/app/api/guest/match/route.ts`
- **Risk:** **Critical**
- **Description:** Creates a guest session for free (`POST /api/guest/session`), then calls this endpoint to trigger OpenAI embedding + Claude Sonnet with 4096 max_tokens. No auth required. A bot creating guest sessions and calling match in a loop can cost ~$150–500/day.
- **Fix:** (1) Per-IP rate limit: 5 match calls per IP per hour. (2) Per-token limit: 1 successful match result per guest token (service already attempts a cache check, but enforce it at the route level before calling the AI pipeline).

### RL-AI-3 — `POST /api/voice/turn` — authenticated but no per-user limit
- **File:** `src/app/api/voice/turn/route.ts`
- **Risk:** High
- **Description:** Each call triggers Claude Haiku + ElevenLabs TTS. An authenticated user can loop this indefinitely. There is a per-session turn counter in `voice_sessions`, but it is not enforced as a hard cap at the API layer.
- **Fix:** Add per-user rate limit: 100 voice turns per day (across all sessions). Enforce the `voice_sessions.turn_count` hard cap server-side before the AI call.

### RL-AI-4 — `POST /api/pathways/match` — authenticated, no per-user limit
- **File:** `src/app/api/pathways/match/route.ts`
- **Risk:** High
- **Description:** This is the authenticated equivalent of guest/match. The service has a 1-hour cache check but a user can bypass it by requesting at exactly the cache boundary, or the cache could fail silently.
- **Fix:** Per-user rate limit: 10 match calls per day. Cache failure should return the stale result, not re-invoke the AI pipeline.

### RL-AI-5 — `POST /api/ask` — authenticated, no per-user limit
- **File:** `src/app/api/ask/route.ts`
- **Risk:** Medium
- **Description:** Lower individual cost (~$0.005), but still unbounded. 1000 calls/day = $5/user/day. The question is Zod-bounded to 2000 characters.
- **Fix:** Per-user rate limit: 100 asks per day. At this limit, worst-case cost is $0.50/user/day.

### RL-AI-6 — `POST /api/cover-letter/generate` — authenticated, no per-user limit
- **File:** `src/app/api/cover-letter/generate/route.ts`
- **Risk:** Medium
- **Description:** Lower cost per call (~$0.01), but no limit. 500 calls/day = $5/user/day.
- **Fix:** Per-user rate limit: 20 cover letter generations per day.

---

## 2. General API Routes

### RL-GEN-1 — `POST /api/guest/session` and `POST /api/voice/guest-session` — no rate limit, admin DB writes
- **Files:** `src/app/api/guest/session/route.ts`, `src/app/api/voice/guest-session/route.ts`
- **Risk:** Medium
- **Description:** Creates rows in `guest_sessions` (admin client, bypasses RLS) with no rate limiting. A bot can fill the table unboundedly.
- **Fix:** Per-IP rate limit: 10 session creations per hour.

### RL-GEN-2 — `POST /api/vault/upload` — authenticated, no explicit upload rate limit
- **File:** `src/app/api/vault/upload/route.ts`
- **Risk:** Medium
- **Description:** Per-user file quota (20 files) is enforced server-side. File size (10MB) is enforced server-side. MIME type is validated server-side against an allowed list. However, there is no rate limit on upload frequency (e.g., a user could re-upload and delete the same file thousands of times per hour to abuse storage bandwidth).
- **Fix:** Per-user rate limit: 30 upload attempts per hour.

### RL-GEN-3 — `PATCH /api/vault/files/[id]` and `DELETE /api/vault/files/[id]` — no rate limit
- **File:** `src/app/api/vault/files/[id]/route.ts`
- **Risk:** Low
- **Description:** Both operations are authenticated and scoped to the user's own documents, but have no rate limit. Low practical risk — the per-file quota and DB ownership check provide a natural bound.
- **Fix:** Low priority. Could add a broad authenticated-route limit of 200 mutating requests per hour if desired.

---

## 3. Document Upload — Server-Side Enforcement Assessment

| Check | Enforced? | Location | Notes |
|---|---|---|---|
| MIME type allowlist | Yes | `src/app/api/vault/upload/route.ts` | Checks `file.type` against `ALLOWED_MIME_TYPES` |
| Magic byte verification | **No** | — | Browser-declared MIME type is trusted — see note below |
| Max file size (10MB) | Yes | `src/app/api/vault/upload/route.ts` | `MAX_FILE_SIZE_BYTES` enforced before upload |
| Per-user file quota (20 files) | Yes | `src/app/api/vault/upload/route.ts` | COUNT query before insert |
| Upload rate limiting | **No** | — | No frequency cap |
| Malware scanning | **No** | — | Not implemented — acceptable for MVP |

**Note on MIME type:** The server checks `file.type` which is the `Content-Type` declared by the HTTP client. A malicious client can send `Content-Type: application/pdf` for a `.php` or `.html` file. This is mitigated by Supabase Storage serving files with the stored content-type header (so a `.php` file stored as `application/pdf` will not be executed), but the mismatch is still worth fixing by reading the first few bytes of the file buffer and comparing against known magic byte signatures.

---

## 4. Recommended Implementation Plan

### Approach: Upstash Redis with `@upstash/ratelimit`

For a Next.js + Vercel stack, the standard approach is:
- **Upstash Redis** (serverless Redis, paid but very cheap at low volume) with the `@upstash/ratelimit` package
- Applied inside route handlers (not middleware) for per-user authenticated limits
- Applied in middleware for per-IP unauthenticated limits

### Suggested limits by endpoint

| Endpoint | Limit | Window | Enforcement Layer |
|---|---|---|---|
| `POST /api/voice/guest-turn` | 50 req/IP | 1 hour | Middleware (edge) |
| `POST /api/guest/match` | 5 req/IP | 1 hour | Middleware (edge) |
| `POST /api/guest/session` | 10 req/IP | 1 hour | Middleware (edge) |
| `POST /api/voice/guest-session` | 10 req/IP | 1 hour | Middleware (edge) |
| `POST /api/voice/turn` | 100 req/user | 24 hours | Route handler |
| `POST /api/pathways/match` | 10 req/user | 24 hours | Route handler |
| `POST /api/ask` | 100 req/user | 24 hours | Route handler |
| `POST /api/cover-letter/generate` | 20 req/user | 24 hours | Route handler |
| `POST /api/vault/upload` | 30 req/user | 1 hour | Route handler |

### Per-tier strategy

| Tier | Voice turns/day | Match calls/day | Ask calls/day | Cover letters/day |
|---|---|---|---|---|
| Guest (unauthenticated) | 25 (per session) | 1 (per token) | 0 | 0 |
| Free (authenticated) | 50 | 3 | 20 | 5 |
| Pro (authenticated) | 300 | 10 | 100 | 30 |

### Edge vs Route Handler

- **Middleware (edge):** Use for all unauthenticated routes (`/api/guest/*`, `/api/voice/guest-*`). Edge runs before the route handler so the AI code never executes on rate-limited requests. Use IP address as key.
- **Route handler:** Use for all authenticated routes. Key on `user.id` (from `requireAuth()`). The middleware cannot reliably get the user ID without calling Supabase, which adds latency — keep per-user limits in the handler.

### Implementation sketch (route handler pattern)

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '24 h'),
  prefix: 'pathways:ask',
});

// Inside the route handler, after requireAuth():
const { success, remaining } = await ratelimit.limit(user.id);
if (!success) {
  return NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Daily limit reached. Upgrade to Pro for more.' } },
    { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
  );
}
```
