# Cost Exposure Audit

## 1. Anthropic API Calls — `max_tokens` Inventory

All Anthropic calls were audited for explicit `max_tokens`. All calls have it set — no uncapped calls found.

| File | Function / Context | Model | max_tokens | Notes |
|---|---|---|---|---|
| `src/modules/voice/service.ts:265` | Voice turn (authenticated) | claude-haiku-4-5-20251001 | 1024 | OK |
| `src/modules/voice/service.ts:778` | Profile extraction | claude-haiku-4-5-20251001 | 1024 | OK |
| `src/modules/voice/service.ts:981` | Summary generation | claude-haiku-4-5-20251001 | 1024 | OK |
| `src/lib/pathway-matcher.ts:660` | Pathway matching (authenticated) | claude-sonnet-4-6 | 4096 | OK — higher cap justified by structured JSON output |
| `src/lib/pathway-matcher.ts:929` | Pathway matching (guest) | claude-sonnet-4-6 | 4096 | OK — same model, same justification |
| `src/app/api/ask/route.ts:185` | RAG Q&A | claude-haiku-4-5-20251001 | 500 | OK |
| `src/app/api/admin/generate-post/route.ts:51` | Blog post generation | claude-haiku-4-5-20251001 | 2000 | OK — admin only |
| `src/app/api/admin/import-resource/route.ts:73` | Resource import | claude-haiku-4-5-20251001 | 500 | OK |
| `src/lib/cover-letter-generator.ts:89` | Cover letter | claude-3-5-haiku-20241022 | 800 | OK |

**All `max_tokens` values are explicitly set. No unbounded Anthropic calls exist.**

---

## 2. ElevenLabs TTS — Input Length Controls

### COST-TTS-1 — No character cap before ElevenLabs TTS call
- **File:** `src/modules/voice/service.ts`, function `textToSpeech` (~line 280–307)
- **Risk:** High
- **Description:** The `text` parameter is sent to ElevenLabs without any length truncation. In normal operation, the input comes from a Claude Haiku response bounded to 1024 tokens (~800 characters), keeping individual calls inexpensive. However:
  1. The function accepts any string — there is no guard at the function boundary.
  2. The guest voice turn route (`POST /api/voice/guest-turn`) calls this with no authentication and no rate limiting. An attacker sending engineered large prompts that produce long Claude responses could increase per-call TTS costs significantly.
  3. ElevenLabs charges per character — a 5000-character response costs ~5× more than an 800-character response.
- **Fix:** Add `const cappedText = text.slice(0, 600);` before the ElevenLabs API call. 600 characters is sufficient for all current voice turn responses and caps per-call cost.

### COST-TTS-2 — No per-user or per-session TTS character budget
- **File:** `src/modules/voice/service.ts`
- **Risk:** Medium
- **Description:** There is no tracking of total characters sent to ElevenLabs per user per day or per session. Combined with the lack of rate limiting on `/api/voice/turn` (authenticated) and `/api/voice/guest-turn` (unauthenticated), total TTS spend is unbounded.
- **Fix:** Track `tts_chars_used` in `voice_sessions` or a `usage_events` table. Enforce a per-session cap (e.g., 20,000 characters ≈ 25 turns × 800 chars/turn).

---

## 3. OpenAI Embedding Calls — Input Length Controls

### COST-EMBED-1 — No hard length bound on embedding input
- **File:** `src/lib/embeddings.ts`, function `embedText` (~line 30–35)
- **Risk:** Low
- **Description:** The function replaces newlines and passes the full string to `text-embedding-3-small`. In the `ask` route, the question is Zod-bounded to 2000 characters (fine). In the pathway matcher, the input is a `profileToNLSummary()` output, which in practice is 500–800 chars but has no enforced cap. `text-embedding-3-small`'s context limit is ~8191 tokens — exceeding it returns an error rather than a runaway cost, so risk is low.
- **Fix:** Add `text.slice(0, 8000)` as a defensive guard before the OpenAI call. Low priority but prevents unexpected errors if summary generation produces unusually long output.

---

## 4. Auto-Triggered AI Calls

AI calls triggered automatically (not by explicit user button press) are the highest runaway cost risk.

| Trigger | Route | AI Called | Auto? | Assessment |
|---|---|---|---|---|
| Onboarding review page load | `POST /api/pathways/match` (called from `onboarding/review` on submit) | Claude Sonnet + OpenAI | Triggered by form submit — not automatic | OK |
| Voice turn | `POST /api/voice/turn` / `POST /api/voice/guest-turn` | Claude Haiku + ElevenLabs | User sends transcript chunk | OK — user-initiated |
| Dashboard page load | None | None | N/A | SECURE |
| Route change | None | None | N/A | SECURE |
| Supabase Realtime | None | None | N/A | SECURE |
| Pathway match cache miss | Re-invokes Claude Sonnet + OpenAI on cache miss | Claude Sonnet + OpenAI | Could be triggered on every page load to `/api/pathways/match` if cache is empty | See COST-AUTO-1 |

### COST-AUTO-1 — Pathway match can re-invoke AI on every cold request
- **File:** `src/lib/pathway-matcher.ts`, `getCachedMatch`
- **Risk:** Medium
- **Description:** `GET /api/pathways/match` checks for a cached result in `pathway_matches` (1-hour TTL). If the cache is cold (no row found), it immediately invokes the full AI pipeline (OpenAI + Claude Sonnet). If the route is called from a client component on every page load or navigation, this becomes an automatic AI trigger whenever the cache has expired.
- **Fix:** Ensure the GET handler returns `null` (not the AI pipeline) when no cache exists — force the user to explicitly trigger matching via the POST endpoint. The GET should be a cache-read only.

---

## 5. Per-User Spend Tracking

### COST-TRACK-1 — No per-user usage tracking or monthly spend cap
- **Risk:** Medium
- **Description:** There is no `usage_events` table, no token counter per user, no monthly cap, and no spend alerting. If a single user (or bot) generates excessive AI calls, the only detection mechanism is an unexpected Anthropic/OpenAI billing alert at the end of the month.
- **Fix:** See Recommended Guardrails section below.

---

## 6. Storage Cost Controls

### Assessment of `POST /api/vault/upload`

| Control | Status | Notes |
|---|---|---|
| MIME type allowlist | Enforced server-side | `ALLOWED_MIME_TYPES` list in route |
| Magic byte verification | **Not enforced** | Trusts browser-declared `Content-Type` |
| Max file size (10MB) | Enforced server-side | `MAX_FILE_SIZE_BYTES` |
| Per-user file quota (20 files) | Enforced server-side | COUNT before insert |
| Upload rate limiting | **Not enforced** | No frequency cap |
| Vector embedding on upload | N/A | Documents are not auto-embedded on upload |

No vector embedding pipeline was found that runs automatically on document upload. Embeddings are generated only in the pathway matching and RAG ask flows — no deduplication risk found.

### COST-STOR-1 — Upload rate not limited, enabling storage bandwidth abuse
- **File:** `src/app/api/vault/upload/route.ts`
- **Risk:** Low
- **Description:** An authenticated user can upload and delete the same 10MB file repeatedly, consuming Supabase Storage bandwidth without hitting the 20-file quota (since each delete frees a slot). This is low risk at current scale but could spike storage transfer costs.
- **Fix:** Add per-user rate limit: 30 upload attempts per hour (see rate-limiting.md).

---

## 7. Vercel Cost Exposure

### COST-VERCEL-1 — Voice turn route streams response, no max duration set
- **Files:** `src/app/api/voice/turn/route.ts`, `src/app/api/ask/route.ts`
- **Risk:** Medium
- **Description:** Both routes stream Anthropic responses using `ReadableStream`. Neither route has a Vercel `maxDuration` export set. In Next.js on Vercel, the default function timeout for the Pro plan is 60 seconds; on the Hobby plan it is 10 seconds. Without an explicit cap, a slow or stalled Anthropic response could hold a Vercel function open for the full platform maximum, consuming function execution time.
- **Fix:** Add `export const maxDuration = 30;` to streaming route files. This is a Vercel-specific Next.js config export, not a code change. Also add an `AbortController` with a `setTimeout` to cancel the Anthropic call if it takes longer than 25 seconds.

### COST-VERCEL-2 — No cache headers on read-heavy GET routes
- **Files:** `src/app/api/vault/files/route.ts` (GET), `src/app/api/pathways/match/route.ts` (GET)
- **Risk:** Low
- **Description:** These GET routes return user-specific data and correctly cannot be CDN-cached. However, they have no `Cache-Control: no-store` header either, which means Vercel's edge may attempt to cache them. Adding explicit no-store prevents ambiguity.
- **Fix:** Add `headers: { 'Cache-Control': 'no-store' }` to responses from GET routes that return user-specific data.

### No polling endpoints found
No route was found that is designed to be polled (e.g., status-check endpoints with short TTLs). Vercel function invocation cost from polling is not a risk in the current codebase.

---

## 8. Recommended Guardrails

### Spend alerting (lightweight, implementable without new infrastructure)

1. **Anthropic Workspaces spend limit:** Set a monthly spend cap in the Anthropic Console (Settings → Usage limits). This is a hard provider-level cutoff — the API returns a 429 when the cap is hit. Recommended: set a monthly alert at 50% of budget and a hard cap at 100%.

2. **Per-user usage table:** Create a `usage_events` table:
   ```sql
   CREATE TABLE usage_events (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES profiles(id),
     event_type text NOT NULL, -- 'voice_turn' | 'pathway_match' | 'ask' | 'cover_letter'
     tokens_used int,
     created_at timestamptz DEFAULT now()
   );
   ```
   Log every AI call with token counts. Aggregate with a daily cron or Postgres trigger.

3. **Soft cap enforcement:** Before each AI call, run a lightweight count query:
   ```sql
   SELECT COUNT(*) FROM usage_events
   WHERE user_id = $1 AND event_type = $2 AND created_at > now() - interval '1 day';
   ```
   If count exceeds the tier limit, return a 429 before invoking the AI API. This is the application-layer cap; the Upstash rate limiter (see rate-limiting.md) is the request-layer cap.

4. **Database-level quota enforcement:** An alternative to application-level checks is a Postgres trigger on `usage_events` that raises an exception when a user exceeds their daily quota. This ensures the cap is enforced even if application code has a bug. This is harder to adjust dynamically (requires migration to change limits) but is more robust.

### Priority order for guardrails

1. Set Anthropic spend limit in console — 15 minutes, zero code
2. Add `maxDuration` exports to streaming routes — 5 minutes
3. Add rate limiting to unauthenticated AI routes (RL-AI-1, RL-AI-2) — highest ROI
4. Add character cap to ElevenLabs calls (COST-TTS-1) — one-line fix
5. Implement `usage_events` table + per-user daily caps — post-MVP
