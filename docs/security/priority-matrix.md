# Security Priority Matrix

Consolidated from auth-and-data.md, rate-limiting.md, cost-exposure.md, and session-and-client.md.

---

## Full Issue Table

| ID | Issue | File(s) | Risk | Effort | Fix First? |
|---|---|---|---|---|---|
| DATA-1 | Guest session migration spreads unvalidated guest-controlled fields into `profiles` via admin client — privilege escalation to `is_admin: true` | `src/modules/guest/service.ts:126–130` | **Critical** | Low (add allowlist before `update()`) | **Yes — before any user testing** |
| RLS-1 | Posts table admin RLS policy uses `user_metadata.role` (user-writable) — any authenticated user can gain write access to posts | `supabase/migrations/20260614000001_posts_table.sql:46–51` | **High** | Low (one SQL policy change + migration) | **Yes — before any user testing** |
| INP-1 | Guest PATCH schema accepts `z.record(z.unknown())` — no field allowlist — input vector for DATA-1 | `src/app/api/guest/[token]/route.ts` | **High** | Low (replace schema with strict Zod object) | **Yes — before any user testing** |
| RL-AI-1 | `POST /api/voice/guest-turn` — unauthenticated, no rate limit, calls Claude Haiku + ElevenLabs per request | `src/app/api/voice/guest-turn/route.ts` | **High** | Medium (add Upstash + session validation) | **Yes — before any user testing** |
| RL-AI-2 | `POST /api/guest/match` — unauthenticated, no rate limit, calls Claude Sonnet 4096 tokens + OpenAI | `src/app/api/guest/match/route.ts` | **High** | Medium (add Upstash per-IP limit) | **Yes — before any user testing** |
| RL-AI-3 | `POST /api/voice/turn` — authenticated but no per-user daily limit, calls Claude + ElevenLabs | `src/app/api/voice/turn/route.ts` | **High** | Medium (Upstash per-user limit) | Yes |
| RL-AI-4 | `POST /api/pathways/match` — authenticated, no per-user limit on expensive Claude Sonnet call | `src/app/api/pathways/match/route.ts` | **High** | Medium (Upstash per-user limit) | Yes |
| COST-TTS-1 | ElevenLabs TTS call has no character length cap — raw text from Claude passed without truncation | `src/modules/voice/service.ts:280–307` | **High** | Low (one-line `text.slice(0, 600)`) | **Yes — before any user testing** |
| AUTH-3 | `POST /api/voice/guest-turn` — `sessionId` not verified against `guest_sessions` DB, any UUID accepted | `src/app/api/voice/guest-turn/route.ts` | **High** | Low (add single DB lookup) | **Yes — before any user testing** |
| SESS-4 | Middleware uses `getSession()` (no JWT verification) instead of `getUser()` | `middleware.ts` | Medium | Low (one-line change) | Yes |
| HDR-2 | Auth callback builds `http://` redirect URLs — protocol not detected from `x-forwarded-proto` | `src/app/auth/callback/route.ts`, `src/app/api/demo/set-state/route.ts` | Medium | Low (use `request.nextUrl.origin`) | Yes |
| HDR-1 | No HTTP security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP) | `next.config.mjs` | Medium | Low (add `headers()` export) | Yes |
| AUTH-4 | `POST /api/guest/session` + `POST /api/voice/guest-session` — public, no rate limit, admin DB writes grow table unboundedly | `src/app/api/guest/session/route.ts`, `src/app/api/voice/guest-session/route.ts` | Medium | Medium (Upstash per-IP) | Yes |
| RL-AI-5 | `POST /api/ask` — authenticated, no per-user daily limit | `src/app/api/ask/route.ts` | Medium | Low (Upstash per-user) | Post-MVP |
| RL-AI-6 | `POST /api/cover-letter/generate` — authenticated, no per-user daily limit | `src/app/api/cover-letter/generate/route.ts` | Medium | Low (Upstash per-user) | Post-MVP |
| SRM-1 | `getCachedMatch` uses admin client for a SELECT that RLS already permits | `src/lib/pathway-matcher.ts:752` | Medium | Low (pass server client instead) | Post-MVP |
| SESS-3 | Guest token passed as URL query parameter — logged in server access logs and browser history | `src/app/auth/callback/route.ts` | Medium | Medium (redesign token passing via state param) | Post-MVP |
| COST-AUTO-1 | GET `/api/pathways/match` triggers full AI pipeline on cache miss — not just cache read | `src/lib/pathway-matcher.ts` | Medium | Low (split GET=cache-read from POST=invoke) | Post-MVP |
| COST-VERCEL-1 | Streaming AI routes have no `maxDuration` export — can hold Vercel function open indefinitely | `src/app/api/voice/turn/route.ts`, `src/app/api/ask/route.ts` | Medium | Low (add `export const maxDuration = 30`) | Yes |
| COST-TRACK-1 | No per-user AI usage tracking or monthly spend cap | All AI routes | Medium | High (new table + logging) | Post-MVP |
| SESS-1 | Guest session token stored in `localStorage` (accessible to JS / XSS) | `src/lib/guest-session.ts` | Medium | Medium (move to sessionStorage or cookie) | Post-MVP |
| COST-TTS-2 | No per-session TTS character budget tracking | `src/modules/voice/service.ts` | Medium | Medium (add counter to voice_sessions) | Post-MVP |
| RL-GEN-1 | Document upload has no upload-frequency rate limit (quota enforced, but not rate) | `src/app/api/vault/upload/route.ts` | Medium | Low (Upstash per-user) | Post-MVP |
| SRM-2 | Self-profile updates use admin client where server client suffices | Multiple routes | Low | Low (swap client) | Post-MVP / hardening |
| COST-EMBED-1 | OpenAI embedding call has no hard input length bound | `src/lib/embeddings.ts` | Low | Low (one-line slice) | Post-MVP |
| SESS-2 | Guest token not cleared from localStorage after Google OAuth path | `src/components/results/SaveResultsModal.tsx` | Low | Low (call clearGuestToken in callback) | Post-MVP |
| INP-2 | Document upload filename not sanitised before storage | `src/app/api/vault/upload/route.ts` | Low | Low (regex replace) | Post-MVP / hardening |
| COST-VERCEL-2 | No `Cache-Control: no-store` on user-specific GET routes | `src/app/api/vault/files/route.ts`, `src/app/api/pathways/match/route.ts` | Low | Low (add header) | Post-MVP / hardening |
| RL-GEN-3 | Vault file PATCH/DELETE endpoints have no rate limit (low practical risk) | `src/app/api/vault/files/[id]/route.ts` | Low | Low (Upstash) | Hardening |
| AUTH-2 | `PATCH /api/guest/[token]` — intentionally unauthenticated; mitigated by fixing INP-1 and DATA-1 | `src/app/api/guest/[token]/route.ts` | Residual Low after fixes | — | Resolved by INP-1 + DATA-1 |

---

## Recommended Sequencing

### Tier 1 — Resolve before any user testing or public access

These issues can cause immediate account compromise, privilege escalation, or runaway AI costs. All have low implementation effort (< 1 hour each) and zero schema migrations required.

| Priority | ID | Why it can't wait | Effort |
|---|---|---|---|
| 1 | DATA-1 | Any authenticated user can escalate to admin by poisoning their own guest session | 30 min |
| 2 | INP-1 | Input vector for DATA-1 — fix together | 15 min |
| 3 | AUTH-3 | Any random UUID triggers Claude + ElevenLabs — no session validation | 20 min |
| 4 | COST-TTS-1 | One-line fix eliminates a cost amplification vector in the unauthenticated voice flow | 5 min |
| 5 | RLS-1 | Any authenticated user can write blog posts by setting their own JWT metadata | 20 min (migration) |
| 6 | RL-AI-1 | Unauthenticated tight-loop attack on Claude + ElevenLabs | 1–2 hours |
| 7 | RL-AI-2 | Unauthenticated tight-loop attack on Claude Sonnet | 1–2 hours |
| 8 | SESS-4 | Middleware route gating uses unverified session cookies | 5 min |
| 9 | HDR-1 | Missing security headers — trivial to add, expected by any security review | 15 min |
| 10 | HDR-2 | `http://` redirects in production behind TLS — can break auth flow | 15 min |
| 11 | COST-VERCEL-1 | `maxDuration` missing on streaming routes — prevents runaway Vercel function costs | 5 min |
| 12 | AUTH-4 | Unbounded guest session table growth — per-IP limit on creation | 1 hour |

### Tier 2 — Resolve post-MVP, before paid launch

These issues are real but do not enable immediate account compromise or high-probability cost explosion. Address them before charging users.

- **RL-AI-3, RL-AI-4** — Per-user rate limits on authenticated AI routes. A paying user abusing these costs money; resolve before billing is live.
- **RL-AI-5, RL-AI-6** — Lighter-weight AI endpoints; less urgent but same pattern.
- **RL-GEN-1** — Upload rate limiting.
- **COST-AUTO-1** — Split GET (cache read) from POST (AI invoke) in pathway matcher.
- **COST-TRACK-1** — Usage tracking table. Required to enforce per-tier limits and produce billing data.
- **SRM-1** — Admin client for read operations. Low risk but good hygiene before scaling.
- **SESS-1, SESS-3** — Guest token handling improvements. Important for trust and compliance.
- **SESS-2** — Token clearance after Google OAuth.
- **COST-TTS-2** — Per-session TTS budget.

### Tier 3 — Ongoing hardening

These are low-risk, low-priority improvements that improve security posture over time but have no urgent timeline.

- **SRM-2** — Replace remaining admin client uses with server client.
- **COST-EMBED-1** — OpenAI input length guard (defensive only — errors rather than runaway cost).
- **INP-2** — Filename sanitisation.
- **COST-VERCEL-2** — Explicit `Cache-Control` headers on GET routes.
- **RL-GEN-3** — Rate limiting on vault file mutations.
- Implement a Content Security Policy (more involved than the basic headers in HDR-1 — requires auditing all script sources).
- Periodic automated migration of `SUPABASE_SECRET_KEY` and AI API keys.
- Malware scanning for vault uploads (ClamAV via a Supabase Edge Function, or a third-party service).
