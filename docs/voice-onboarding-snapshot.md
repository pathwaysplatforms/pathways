# Voice Onboarding & Pathway Matching — Snapshot

> **Purpose:** Restore point for Phase 2 (Akinator Matcher). Reflects code state as of June 2026.
> Do not modify this file during Phase 2 work; update it only after Phase 2 lands.

---

## 1. Entry Point

**Route:** `/onboarding/voice` → `src/app/onboarding/voice/page.tsx`

The page is a server component that checks `profile.onboarding_step`:
- `"voice_complete"` → redirect to `/onboarding/review`
- `"complete"` → redirect to `/dashboard`
- Anything else → render `<OnboardingLayout />`

`/onboarding` (root) always redirects straight to `/onboarding/voice`.

**Main UI shell:** `src/components/onboarding/OnboardingLayout.tsx`
- Renders three mode tabs: Voice (default), Chat, Form.
- Voice mode mounts `<VoiceTab />` on the left and `<VoiceProfilePanel />` (live CRS + field tracker) on the right.

---

## 2. Gladia STT Integration

**Token route:** `GET /api/voice/gladia-token` → `src/app/api/voice/gladia-token/route.ts`

Two-step server-side handshake (GLADIA_API_KEY never sent to browser):

```
Server:  POST https://api.gladia.io/v2/live
         Headers: x-gladia-key: $GLADIA_API_KEY
         Body: {
           encoding: "wav/pcm",
           sample_rate: 16000,
           bit_depth: 16,
           channels: 1,
           model: "solaria-1",
           endpointing: 1.0,           // 1 s silence → utterance end
           language_config: { languages: ["en"] },
           messages_config: {
             receive_partial_transcripts: false,
             receive_final_transcripts: true,
             receive_speech_events: true,  // speech_start / speech_end events
           }
         }
Response: { id: string, url: string }   ← single-use WSS URL
```

**Browser side** (`src/components/onboarding/VoiceTab.tsx`, `connectGladia`, lines 323–381):

1. `GET /api/voice/gladia-token` → receives `{ url }`.
2. `new WebSocket(url)` with an 8-second connection timeout.
3. On `ws.onopen`:
   - `AudioContext({ sampleRate: 16000 })` created.
   - `createMediaStreamSource` → `createAnalyser` (for waveform) → `createScriptProcessor(2048, 1, 1)`.
   - `onaudioprocess`: if `ws.OPEN && !isProcessingTurnRef`, call `floatTo16BitPCM(channelData)` and `ws.send(buffer)`.
4. `ws.onmessage` → `handleGladiaMessage()`.

**Message handling** (`handleGladiaMessage`, lines 282–321):

| Gladia event | Action |
|---|---|
| `type === "transcript"` + `is_final === true` | Append segment to `currentTranscriptRef` |
| `type === "speech_end"` | 300 ms debounce timer → call `sendTurn(transcript)` if not mid-turn |

The 300 ms debounce waits for any in-flight final transcript to arrive before firing `sendTurn`.

---

## 3. Haiku Turn Handler

**Route:** `POST /api/voice/turn` → `src/app/api/voice/turn/route.ts`

Validates `TurnRequestSchema` (Zod), then calls `streamConversationTurn()` as an async generator piped into a `ReadableStream` SSE response.

**Core service:** `src/modules/voice/service.ts`

### 3a. System Prompt (`VOICE_SYSTEM_PROMPT`, lines 14–131)

Full text (verbatim, not summarised):

```
You are the onboarding assistant for Pathways, an AI-powered Canadian immigration
guidance platform. Your job is to learn about the user through a warm, natural
conversation so we can identify which Canadian immigration pathway fits them best.

You are NOT a lawyer. Never give legal advice or guarantee any outcome.

LANGUAGE: If the user speaks or writes in French at any point, switch entirely to
French and stay in French for the rest of the conversation.

YOUR GOAL: Collect the following fields through natural conversation. Do not make
it feel like a form — ask follow-up questions naturally, show genuine curiosity,
and acknowledge what they share.

FIELDS TO COLLECT (suggested order, adapt naturally):
1.  full_name
2.  date_of_birth (day, month, year)
3.  nationality
4.  current_country
5.  marital_status
6.  occupation — infer noc_teer_category silently
7.  years_experience
8.  canadian_work_years / foreign_work_years / canadian_work_recent
9.  education_level_voice + silent education_level mapping
10. eca_obtained (only if foreign degree)
11. language_proficiency_self
12. CLB scores (convert from IELTS/CELPIP/TEF/TCF, or map from self-assessed)
13. has_family_in_canada
14. intended_province
15. Spouse section (only if married/common-law):
    spouse_coming_to_canada
16. Bonus factors (grouped): has_canadian_job_offer, has_provincial_nomination

STRICT RULES:
- 1–3 sentences max per turn (voice conversation)
- Never ask for CLB numbers directly or a NOC code
- After all fields confirmed, give warm summary and ask "Does that all sound right?"
- When confirmed, set complete: true in PROFILE_DELTA
```

CLB conversion table, TEER inference rules, and education level mapping are also embedded in the prompt (full text in file lines 44–91).

**Context injection** (per turn, lines 716–717):

```
{VOICE_SYSTEM_PROMPT}

## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN
  full_name: "Priya Sharma"
  ...
```

### 3b. How User Turns Are Sent

`streamConversationTurn()` (lines 626–831):

1. **Opening turn guard** (empty transcript + empty history): returns hardcoded `OPENING_GREETING` without calling Claude.
2. Fetches `voice_sessions` row to get `extracted_data` (accumulated partial profile) and `transcript`.
3. Builds `messages` array from `history.slice(-20)` + current user transcript.
4. Streams Claude response via `anthropic.messages.stream(...)`, collecting `fullText`.
5. Calls `parseProfileDeltaResponse(fullText)` → `{ message, delta, complete, requires_review }`.

### 3c. Parsing the Response

`parseProfileDeltaResponse` (lines 174–224) + `extractProfileDeltaJson` (lines 138–168):

The `<PROFILE_DELTA>` XML tag wraps a JSON object appended to every Claude response. The parser:
1. Finds `<PROFILE_DELTA>` tag start.
2. Brace-counts from `{` to matching `}` (robust against whitespace/newlines inside the JSON).
3. Falls back to `</PROFILE_DELTA>` slice if brace-counting fails.
4. Strips the entire `<PROFILE_DELTA>...</PROFILE_DELTA>` block from the spoken message text.
5. Coerces integer fields (`years_experience`, `clb_*`, `canadian_work_years`, `foreign_work_years`, `noc_teer_category`).
6. Validates typed delta against `TurnResponseSchema.shape.delta`; returns `{}` on schema failure.

### 3d. How TTS Is Triggered

After parsing (`streamConversationTurn`, lines 752–785):

1. `splitIntoSentences(message)` → array of sentence strings.
2. `Promise.all(sentences.map(textToSpeech))` — all sentences TTS'd concurrently.
3. Each successful result yielded as `{ type: "audio", index, audioBase64, sentence }` SSE event.
4. Failed sentence TTS is logged and skipped (does not abort stream).
5. Final `{ type: "meta", message, complete, delta, requires_review }` event yielded.

**TTS provider** (`textToSpeech`, lines 269–296):

```
POST https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}
Headers: xi-api-key: $ELEVENLABS_API_KEY
Body: {
  text,
  model_id: "eleven_multilingual_v2",
  voice_settings: { stability: 0.5, similarity_boost: 0.75 }
}
Returns: MP3 ArrayBuffer → base64 string
```

---

## 4. Pathway Matching

### 4a. `triggerPathwayRecognition`

**Location:** `src/lib/pathway-recognition.ts`

This function is **fire-and-forget** (documented "never throws"). It is **not called from the voice turn handler**. As of this snapshot, it is only referenced in:
- `src/modules/dashboard/service.ts` (dashboard pathway refresh path)
- `tests/unit/pathway-recognition.test.ts`

It is **not triggered at voice session completion**. The actual write path after voice completes is:

```
finalizeVoiceSession()
  └─→ profiles.voice_session_data = extractedProfile
      profiles.onboarding_status = "voice_complete"
      (pathway_input_json is NOT written here)

confirmVoiceProfile()   ← called from review page confirmation
  └─→ profiles.onboarding_status = "complete"
      (pathway_input_json still NOT written here)
```

`triggerPathwayRecognition` writes to `profiles.pathway_input_json` with this shape:

```typescript
{
  nationality, destination_country, purpose,
  date_of_birth, marital_status, dependents,
  clb_speaking, clb_listening, clb_reading, clb_writing,
  occupation, noc_teer_category,
  canadian_work_years, foreign_work_years,
  canadian_work_recent, foreign_work_recent,
  education_level, eca_obtained,
  has_provincial_nomination, has_canadian_job_offer, has_sibling_in_canada,
  spouse_coming_to_canada, spouse_education_level, spouse_canadian_work_years,
  crs_estimate: estimate.score,
  crs_estimate_low: estimate.low,
  crs_estimate_high: estimate.high,
}
```

The `crs_estimate*` fields are computed from `computeCrsEstimate(profile)` in `src/lib/crs-estimate.ts`.

### 4b. Async Pathway Matching Engine

The full 8-stage pipeline lives in `src/lib/pathway-matcher.ts`. It is triggered **after the review step** via `POST /api/pathways/match` fired as a background fetch from `POST /api/onboarding/confirm`.

The confirm route writes `pathway_input_json` (via `buildPathwayInput()` in `src/lib/pathway-input.ts`) and then fires the matcher asynchronously — the user is redirected to `/pathways/results` which polls `GET /api/pathways/match` until results land.

---

## 5. Profile Fields Collected

The voice session collects these fields (defined in `src/modules/voice/types.ts`, `VoiceExtractedProfileSchema`):

| Field | Type | Source |
|---|---|---|
| `full_name` | `string \| null` | Spoken |
| `date_of_birth` | `string \| null` (YYYY-MM-DD) | Spoken |
| `nationality` | `string \| null` | Spoken |
| `current_country` | `string \| null` | Spoken |
| `marital_status` | `enum \| null` | Spoken |
| `education_level_voice` | `string \| null` | Spoken (raw text) |
| `education_level` | `enum \| null` | Inferred by Haiku |
| `eca_obtained` | `boolean \| null` | Spoken |
| `occupation` | `string \| null` | Spoken |
| `noc_teer_category` | `0–5 \| null` | Inferred by Haiku |
| `noc_code` | `string \| null` | Inferred by Haiku (rarely set) |
| `years_experience` | `number \| null` | Spoken |
| `canadian_work_years` | `number \| null` | Spoken |
| `foreign_work_years` | `number \| null` | Computed (years_experience − canadian_work_years) |
| `canadian_work_recent` | `boolean \| null` | Spoken (in last 3 years?) |
| `foreign_work_recent` | `boolean \| null` | Spoken (within last 10 years?) |
| `has_canadian_experience` | `boolean \| null` | Derived |
| `language_proficiency_self` | `enum \| null` | Spoken |
| `clb_speaking` | `0–12 \| null` | Converted from test scores or self-assessment |
| `clb_listening` | `0–12 \| null` | Same |
| `clb_reading` | `0–12 \| null` | Same |
| `clb_writing` | `0–12 \| null` | Same |
| `has_family_in_canada` | `boolean \| null` | Spoken |
| `intended_province` | `string \| null` | Spoken |
| `spouse_coming_to_canada` | `boolean \| null` | Spoken (only if married/common-law) |
| `has_provincial_nomination` | `boolean` | Spoken (default `false`) |
| `has_canadian_job_offer` | `boolean` | Spoken (default `false`) |
| `destination_country` | `string \| null` | Not asked in voice — defaults to Canada |
| `purpose` | `string \| null` | Not asked in voice |
| `dependents` | `number \| null` | Not asked in voice |
| `requires_review` | `string[]` | Fields flagged by Haiku as uncertain |

**Fields NOT collected by voice** (only appear in review/form flows or DB-only):
`annual_income`, `income_currency`, `has_sibling_in_canada`, `spouse_education_level`, `spouse_clb_*`, `spouse_canadian_work_years`

**`profile_completeness_pct`** is computed by `computeProfileCompletenessPct()` (`src/lib/completeness.ts`) against these 19 fields: `full_name`, `date_of_birth`, `nationality`, `current_country`, `marital_status`, `occupation`, `noc_teer_category`, `years_experience`, `canadian_work_years`, `foreign_work_years`, `education_level`, `eca_obtained`, `clb_speaking`, `clb_listening`, `clb_reading`, `clb_writing`, `intended_province`, `has_provincial_nomination`, `has_canadian_job_offer`.

---

## 6. State Machine

**Component:** `src/components/onboarding/VoiceTab.tsx`

**`OrbState`** (defined at line 8, imported from `PathwaysOrb`):

```typescript
type OrbState = "idle" | "listening" | "thinking" | "speaking";
```

State transitions:

```
idle ──[Begin clicked]──► speaking (opening greeting plays)
                              │
                              ▼
                          listening ◄──────────────────────────┐
                              │                                 │
                   [speech_end + 300ms debounce]                │
                              │                                 │
                              ▼                                 │
                          thinking                              │
                              │                                 │
                   [SSE audio chunks arrive]                    │
                              │                                 │
                              ▼                                 │
                          speaking ──[audio queue drained]──────┘
                                                │
                              [complete: true from meta event]
                                                │
                                                ▼
                                    thinking ("Building your pathway…")
                                                │
                                    [1.5s delay + cleanup]
                                                │
                                                ▼
                                    router.push("/dashboard")
```

Additional UI state refs (not `OrbState`):

| Ref | Purpose |
|---|---|
| `isProcessingTurnRef` | Guards against concurrent turns |
| `pendingSpeechEndRef` | Holds `speech_end` until transcript arrives |
| `speechEndTimerRef` | 300 ms debounce handle |
| `turnAbortRef` | AbortController for current SSE fetch |
| `currentAudioRef` | Active `<audio>` element (for mid-playback abort) |

**`statusOverride`** (React state): overrides `STATUS_TEXT[orbState]` display during the post-completion transition ("Building your pathway…").

**Error state:** `error: string | null` React state — surfaced as red text below the orb. Does not block recovery; `orbState` resets to `"idle"` or `"listening"` on error.

---

## 7. Known Issues

### 7a. `profile_completeness_pct` not recalculated on review edits

**Location:** `src/modules/voice/service.ts`, `confirmVoiceProfile()` (lines 844–883)

This is the correct path — it fetches the current profile, merges user edits, recomputes completeness, and writes both together. **This works correctly.**

However, the earlier `finalizeVoiceSession()` call (lines 542–619) also writes `profile_completeness_pct` using `computeProfileCompletenessPct(extractedProfile)` from the voice session. If the user then edits fields on the review page, `confirmVoiceProfile()` does recalculate — so the final value is correct. There is no bypass bug in the current code; the concern is that `finalizeVoiceSession` writes an intermediate value that could be stale if the user skips the review page (e.g., direct navigation to `/dashboard`).

### 7b. `triggerPathwayRecognition` is orphaned from the voice flow

`triggerPathwayRecognition` writes `pathway_input_json` but is not called from `finalizeVoiceSession` or `confirmVoiceProfile`. The `pathway_input_json` column is written by `buildPathwayInput()` in the confirm route instead. This means the `has_sibling_in_canada`, `spouse_education_level`, and `spouse_canadian_work_years` fields in `triggerPathwayRecognition`'s shape are never populated from voice (they are voice-unasked fields), so `triggerPathwayRecognition`'s output shape diverges from what the confirm route writes.

**Impact:** If `triggerPathwayRecognition` is ever called from the voice path (e.g., in Phase 2), care must be taken that its `pathway_input_json` shape matches exactly what the matching engine expects. The authoritative production shape is the one written by `buildPathwayInput()`.

### 7c. Audio is not sent to Gladia during AI speaking turns

`onaudioprocess` guards with `&& !isProcessingTurnRef.current` — mic audio is suppressed while the AI is speaking or thinking. This prevents Claude's own TTS from being transcribed back. However, it means the user cannot interrupt mid-turn; they must wait for the AI to finish before their speech is captured.

### 7d. History window capped at 20 turns

`history.slice(-20)` is applied both in `callClaude` and `streamConversationTurn`. For sessions that exceed 20 turns (unlikely in ~3-minute design, but possible), early context is lost. Claude will not have access to fields the user mentioned more than 20 turns ago unless they are in the `FIELDS ALREADY COLLECTED` injection.

### 7e. `noc_code` is listed in the Zod schema but never populated by voice

The system prompt instructs Haiku to infer `noc_teer_category` silently from occupation but never to ask for or emit a `noc_code`. The field exists in `VoiceExtractedProfile` and is written to `profiles.noc_code` in `finalizeVoiceSession`, but will always be `null` after a voice session.

### 7f. `education_level_voice` not written to `profiles` flat column

`finalizeVoiceSession` writes `education_level_voice` to `profiles` (line 591). However, `confirmVoiceProfile` uses `ConfirmRequestSchema` updates which may or may not include it — there is no explicit handling of `education_level_voice` in the confirm path. The field survives in `voice_session_data` JSONB regardless.

---

## File Index

| File | Role |
|---|---|
| `src/app/onboarding/voice/page.tsx` | Route entry; redirects on `onboarding_step` |
| `src/app/onboarding/page.tsx` | Root onboarding redirect |
| `src/components/onboarding/OnboardingLayout.tsx` | Tab shell (Voice / Chat / Form) |
| `src/components/onboarding/VoiceTab.tsx` | Gladia WebSocket, mic capture, turn loop, audio queue |
| `src/components/onboarding/ChatTab.tsx` | Text-based, same `/api/voice/turn` backend |
| `src/components/onboarding/FormTab.tsx` | Structured form, 13 fields |
| `src/components/voice/PathwaysOrb.tsx` | Animated orb UI (`OrbState` type exported here) |
| `src/components/voice/VoiceProfilePanel.tsx` | Live CRS bar + collected field tracker |
| `src/modules/voice/service.ts` | `streamConversationTurn`, `finalizeVoiceSession`, `confirmVoiceProfile` |
| `src/modules/voice/types.ts` | `VoiceExtractedProfile`, `TurnRequestSchema`, `TurnResponseSchema` (Zod) |
| `src/app/api/voice/session/route.ts` | `POST /api/voice/session` — create/resume session |
| `src/app/api/voice/gladia-token/route.ts` | `GET /api/voice/gladia-token` — Gladia WSS handshake |
| `src/app/api/voice/turn/route.ts` | `POST /api/voice/turn` — SSE stream endpoint |
| `src/lib/pathway-recognition.ts` | `triggerPathwayRecognition()` — writes `pathway_input_json` (orphaned from voice path) |
| `src/lib/pathway-input.ts` | `buildPathwayInput()` — production `pathway_input_json` writer |
| `src/lib/pathway-matcher.ts` | 8-stage matching pipeline (embedding → vector → hard filter → Claude Sonnet) |
| `src/lib/crs-estimate.ts` | `computeCrsEstimate()` — CRS scoring with margin |
| `src/lib/completeness.ts` | `computeProfileCompletenessPct()` — 19-field denominator |
| `src/lib/embeddings.ts` | OpenAI embedding wrapper, `profileToNLSummary()` |
| `src/app/api/pathways/match/route.ts` | `GET` (cached result) / `POST` (run pipeline) |
| `src/app/onboarding/review/review-client.tsx` | Inline editing + confirm trigger |
| `src/app/api/onboarding/confirm/route.ts` | Marks onboarding complete, fires background matcher |
| `src/app/api/onboarding/profile/route.ts` | Persists review-page field edits |
