# Upstash Redis — rate limiting setup

This app rate-limits the endpoints that call paid AI/TTS vendors (Claude,
ElevenLabs, OpenAI embeddings). The limiter lives in `src/lib/rate-limit.ts` and
has two backends:

- **Upstash Redis** (recommended, and what this guide sets up) — a shared store,
  so limits are enforced **globally across every serverless instance**.
- **In-memory fallback** — used automatically when Upstash env vars are absent.
  It only counts within a single warm instance, so a distributed flood can still
  get `limit × number-of-instances`. Fine for local dev; **not** for production.

Right now, if you deploy without configuring Upstash, everything still works — it
just silently uses the weaker fallback. This guide gets you the real thing.

---

## Why this is handy for you

- **Stops cost-drain abuse.** The guest endpoints are unauthenticated: anyone can
  hit `POST /api/guest/session` to mint a token and then flood the voice/match
  endpoints, each of which spends money on Claude + ElevenLabs + OpenAI. A global
  limiter caps that no matter how the traffic is spread across instances.
- **Protects logged-in users too.** `/api/ask`, `/api/cover-letter/generate`, and
  `/api/voice/turn` are limited per user id, so one account can't run up your bill.
- **Serverless-correct.** On Vercel, requests land on many short-lived function
  instances. Only a shared store (Redis) can enforce a true global limit; in-memory
  counters reset on cold starts and don't see each other.
- **Nearly free at this scale.** Upstash's free tier (hundreds of thousands of
  commands/month) is plenty for rate-limit counters, and it's pay-per-request so
  there's no idle cost.

---

## Option A — provision through Vercel (recommended)

This wires the env vars into your Vercel project automatically.

1. Go to your project on **vercel.com → Storage → Marketplace** (or the
   **Integrations** tab) and pick **Upstash** → **Redis**.
2. Create a database (choose the region closest to your functions; global is fine).
3. Connect it to this project. Vercel injects these env vars into the project's
   Production/Preview/Development environments:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Pull them into your local `.env.local` so local runs use the same store:

   ```bash
   vercel env pull .env.local
   ```

5. Redeploy (or `vercel deploy`) so the running functions pick up the vars.

## Option B — provision through the Upstash console

Use this if you're not on Vercel or want to manage it directly.

1. Sign up at **console.upstash.com** and create a **Redis** database.
2. On the database page, open the **REST API** section and copy:
   - **UPSTASH_REDIS_REST_URL** → `UPSTASH_REDIS_REST_URL`
   - **UPSTASH_REDIS_REST_TOKEN** → `UPSTASH_REDIS_REST_TOKEN`
3. Add both to your environment:
   - Locally: put them in `.env.local` (see `.env.example` for the placeholders).
   - On Vercel: **Settings → Environment Variables**, add both for every
     environment you deploy, then redeploy.

> Use the **REST** URL/token (works over HTTPS from serverless), not the native
> `redis://` connection string.

---

## How to verify it's active

The app decides at runtime: if both vars are present it uses Upstash, otherwise the
in-memory fallback. To confirm Upstash is in use:

1. Make sure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in the
   environment you're testing.
2. Exceed a limit on purpose — e.g. send `POST /api/guest/session` more than
   10 times in a minute from the same IP. You should get **HTTP 429** with a
   `Retry-After` header.
3. In the **Upstash console → Data Browser**, you'll see keys prefixed with
   `pw-rl` being created — that's the shared counter. If those keys appear, the
   distributed backend is working.

## The limits currently configured

| Endpoint                     | Auth          | Key      | Limit      |
|------------------------------|---------------|----------|------------|
| `POST /api/guest/session`    | none          | client IP| 10 / min   |
| `POST /api/voice/guest-turn` | none          | client IP| 20 / min   |
| `POST /api/guest/match`      | none          | client IP| 5 / min    |
| `POST /api/ask`              | user          | user id  | 30 / min   |
| `POST /api/cover-letter/generate` | user     | user id  | 10 / min   |
| `POST /api/voice/turn`       | user          | profile id | 40 / min |

To change a limit, edit the `enforceRateLimit(key, { limit, windowMs })` call in the
corresponding route under `src/app/api/…`. No redeploy of the limiter itself is
needed — the values live inline at each call site.

## Notes & gotchas

- **IP spoofing:** guest limits key on `X-Forwarded-For`. Vercel sets this from the
  real edge connection, but if you ever put another proxy in front, make sure it
  doesn't let clients forge the header.
- **Local dev without Upstash** is fine — you'll just get per-process limits, which
  is enough to see the 429 behaviour while developing.
- **Failure mode:** if Upstash is unreachable mid-request, the `@upstash/ratelimit`
  call throws and the request errors out (fail-closed for that request). If you'd
  rather fail-open under an outage, wrap the call — say the word and I'll add it.
