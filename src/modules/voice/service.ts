import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ValidationError, DatabaseError } from "@/lib/errors";
import { TurnResponseSchema, VoiceExtractedProfileSchema, ConfirmRequestSchema } from "./types";
import type { TurnResponse, VoiceExtractedProfile, Message, PartialExtractedProfile, ConfirmRequest } from "./types";

const OPENING_GREETING =
  "Welcome to Pathways. I'm here to guide you through your " +
  "immigration journey. Let's start with the basics — " +
  "what's your full name, and which country are you currently living in?";

const CLAUDE_SYSTEM_PROMPT = `You are a voice onboarding assistant for Pathways, an immigration guidance platform. You collect the user's profile through a natural conversation. The user is speaking — their words are transcribed, so expect informal phrasing, accents, and filler words.

## YOUR GOAL
Collect all of these fields across the conversation:
- full_name: their full legal name
- nationality: their country of citizenship
- current_country: country they currently live in
- occupation: their current job title or profession
- years_experience: number of years of professional experience (output as integer)
- has_degree: whether they hold a university degree (boolean)
- degree_level: one of: bachelor, master, phd, other
- degree_field: the subject area of their degree (e.g. "software engineering", "law")
- annual_salary_gbp: approximate annual salary converted to GBP as an integer (convert from any currency if needed — use approximate exchange rates)
- has_criminal_record: whether they have any criminal convictions (boolean)
- english_level: one of: native, fluent, b2, b1, below_b1
- marital_status: one of: single, married, divorced, widowed, common-law
- has_dependents: whether they have children or other dependents (boolean)

## CONVERSATION RULES
- The conversation has already started with a greeting. Do not re-greet. Continue collecting fields.
- Ask 1-2 questions per turn. Group related fields naturally (e.g. nationality + current country, degree level + field).
- When a field is already collected, never ask for it again.
- If the user volunteers information about a future field unprompted, capture it in the delta — do not ask for it again later.
- If the user gives vague or unclear information, ask one gentle follow-up. If still unclear, record what you have and add the field name to requires_review.
- Close naturally and set complete:true only when all fields have been collected or best-effort collected.

## META-REQUEST HANDLING (critical)
The user may say things like "can you repeat that", "what did you ask", "I didn't understand", "say that again", or similar.
When this happens:
- Look at your last message in the conversation history and repeat it naturally, rephrased slightly.
- Output an empty delta: {}.
- Do NOT set complete:true.
- Do NOT ask a new question in the same turn as a repeat.

## HANDLING EXTRA INFORMATION
If the user answers multiple fields at once or volunteers future fields:
- Extract ALL fields mentioned in the delta for this turn.
- Acknowledge what was captured briefly.
- Ask only about fields NOT yet answered.

## DATA EXTRACTION RULES
- years_experience: always output as an integer. "About 5 years" → 5. "A decade" → 10. "2-3 years" → 2.
- annual_salary_gbp: always output as an integer in GBP. "80k USD" → 64000. "60k EUR" → 51000. "50k" with no currency → ask which currency if unclear, otherwise assume GBP.
- has_degree, has_criminal_record, has_dependents: output as boolean true or false. "No convictions" → false. "Yes I have kids" → true.
- english_level: map naturally. "I'm a native speaker" → native. "I speak English well" → fluent. If unclear, ask directly.
- degree_level: map "masters" or "master's" → master. "PhD" or "doctorate" → phd. "Bachelor's" or "undergraduate" → bachelor.

## OUTPUT FORMAT — CRITICAL
You MUST respond with ONLY a valid raw JSON object. No prose, no markdown, no code fences, no explanation before or after the JSON. Your entire response must be directly parseable by JSON.parse() with zero preprocessing.

Required shape:
{"message":"<what you say to the user>","delta":{<only fields extracted THIS turn, empty {} if none>},"complete":<true or false>,"requires_review":[<field names that need review, empty [] if none>]}

Rules:
- "message" is what gets spoken aloud. Write it as natural spoken language.
- "delta" contains ONLY fields you newly extracted in this turn. Do not repeat fields already in history.
- "complete" is false until all fields are collected.
- "requires_review" lists field names where the user's answer was unclear or refused.

CORRECT example (user answered two fields):
{"message":"Got it, 5 years of experience. Do you hold a university degree?","delta":{"occupation":"software engineer","years_experience":5},"complete":false,"requires_review":[]}

CORRECT example (meta-request — user asked to repeat):
{"message":"I was asking about your level of English — would you say you are a native speaker, fluent, or somewhere around B2 level?","delta":{},"complete":false,"requires_review":[]}

WRONG — never do this:
Thank you. Do you have any criminal convictions?`;

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Call Claude API and return a validated per-turn response. */
async function callClaude(history: Message[], newTranscript: string): Promise<TurnResponse> {

  const userTurn: Anthropic.MessageParam[] = newTranscript.trim()
    ? [{ role: "user", content: newTranscript }]
    : [];

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    ...userTurn,
  ];

  // Seed the very first call so the API never receives an empty messages array.
  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    temperature: 0,
    system: CLAUDE_SYSTEM_PROMPT,
    messages,
  });

  const content = response.content[0];
  if (!content || content.type !== "text") {
    throw new ValidationError("Unexpected Claude response type");
  }

  let parsed: unknown;
  try {
    const cleaned = content.text
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ValidationError("Claude response was not valid JSON");
  }

  const validated = TurnResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new ValidationError("Claude response failed schema validation", {
      errors: validated.error.errors.map((e) => e.message),
    });
  }

  return validated.data;
}

/** Call ElevenLabs TTS and return audio as a base64 string. */
async function textToSpeech(text: string): Promise<string> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "FnOMXRlQ59aZ9SSpc3UZ";
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new ValidationError("ELEVENLABS_API_KEY environment variable is not set");
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    throw new DatabaseError("ElevenLabs TTS request failed", { status: response.status });
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/** Merge a Claude delta into the running partial extracted profile. */
function mergeDelta(
  current: PartialExtractedProfile,
  delta: TurnResponse["delta"],
  newRequiresReview: string[]
): PartialExtractedProfile {
  const merged: PartialExtractedProfile = { ...current };
  for (const [k, v] of Object.entries(delta)) {
    if (v !== undefined) {
      (merged as Record<string, unknown>)[k] = v;
    }
  }
  const existingReview = current.requires_review ?? [];
  merged.requires_review = [...new Set([...existingReview, ...newRequiresReview])];
  return merged;
}

/** Fill any missing fields with null to produce a complete VoiceExtractedProfile. */
function buildFinalProfile(partial: PartialExtractedProfile): VoiceExtractedProfile {
  return {
    full_name: partial.full_name ?? null,
    nationality: partial.nationality ?? null,
    current_country: partial.current_country ?? null,
    occupation: partial.occupation ?? null,
    years_experience: partial.years_experience ?? null,
    has_degree: partial.has_degree ?? null,
    degree_level: partial.degree_level ?? null,
    degree_field: partial.degree_field ?? null,
    annual_salary_gbp: partial.annual_salary_gbp ?? null,
    has_criminal_record: partial.has_criminal_record ?? null,
    english_level: partial.english_level ?? null,
    marital_status: partial.marital_status ?? null,
    has_dependents: partial.has_dependents ?? null,
    requires_review: partial.requires_review ?? [],
  };
}

/** Create a new voice session row and return its ID. */
export async function createVoiceSession(profileId: string, log: Logger): Promise<string> {
  log.info({ action: "voice.session.start", profileId });

  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data, error } = await db
    .from("voice_sessions")
    .insert({
      profile_id: profileId,
      status: "in_progress",
      transcript: "",
      extracted_data: {},
      duration_seconds: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DatabaseError("Failed to create voice session", { profileId }, error ?? undefined);
  }

  const sessionId = (data as { id: string }).id;
  log.info({ action: "voice.session.created", sessionId });
  return sessionId;
}

/**
 * Split text into speakable sentence chunks.
 * Keeps punctuation attached to the preceding sentence.
 */
function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Chunk sent over SSE for each sentence of the agent's response. */
export interface TurnChunk {
  type: "audio";
  index: number;
  audioBase64: string;
  sentence: string;
}

/** Final metadata chunk sent after all audio chunks. */
export interface TurnMeta {
  type: "meta";
  message: string;
  complete: boolean;
  delta: TurnResponse["delta"];
  requires_review: string[];
}

/** Error event yielded when a turn fails mid-stream. */
export interface TurnError {
  type: "error";
  message: string;
}

export type TurnStreamEvent = TurnChunk | TurnMeta | TurnError;

/** Shape returned by processConversationTurn. */
export interface TurnResult {
  message: string;
  complete: boolean;
  audioBase64: string;
}

/** Process one conversation turn: call Claude, merge delta, TTS, optionally finalize. */
export async function processConversationTurn(
  sessionId: string,
  profileId: string,
  transcript: string,
  history: Message[],
  sessionStartMs: number,
  log: Logger
): Promise<TurnResult> {
  log.info({ action: "voice.turn.start", sessionId });

  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  const { data: session, error: sessionError } = await db
    .from("voice_sessions")
    .select("id, profile_id, extracted_data, transcript")
    .eq("id", sessionId)
    .eq("profile_id", profileId)
    .single();

  if (sessionError || !session) {
    throw new DatabaseError(
      "Voice session not found or access denied",
      { sessionId },
      sessionError ?? undefined
    );
  }

  const sessionRow = session as {
    id: string;
    profile_id: string;
    extracted_data: unknown;
    transcript: string | null;
  };

  const currentPartial = (sessionRow.extracted_data ?? {}) as PartialExtractedProfile;
  const currentTranscript = sessionRow.transcript ?? "";

  const turnResponse = await callClaude(history, transcript);

  const updatedPartial = mergeDelta(currentPartial, turnResponse.delta, turnResponse.requires_review);

  const updatedTranscript =
    currentTranscript +
    (currentTranscript ? "\n" : "") +
    (transcript.trim() ? `User: ${transcript}\n` : "") +
    `Agent: ${turnResponse.message}`;

  const { error: updateError } = await db
    .from("voice_sessions")
    .update({ extracted_data: updatedPartial, transcript: updatedTranscript })
    .eq("id", sessionId);

  if (updateError) {
    throw new DatabaseError("Failed to update voice session", { sessionId }, updateError);
  }

  if (turnResponse.complete) {
    const durationSeconds = Math.round((Date.now() - sessionStartMs) / 1000);
    await finalizeVoiceSession(
      sessionId,
      profileId,
      buildFinalProfile(updatedPartial),
      updatedTranscript,
      durationSeconds,
      log
    );
  }

  const audioBase64 = await textToSpeech(turnResponse.message);

  log.info({ action: "voice.turn.complete", sessionId, complete: turnResponse.complete });

  return { message: turnResponse.message, complete: turnResponse.complete, audioBase64 };
}

/** Write the finalized profile to voice_sessions and profiles tables. */
export async function finalizeVoiceSession(
  sessionId: string,
  profileId: string,
  extractedProfile: VoiceExtractedProfile,
  fullTranscript: string,
  durationSeconds: number,
  log: Logger
): Promise<void> {
  log.info({ action: "voice.session.finalizing", sessionId, profileId });

  const status = extractedProfile.requires_review.length > 0 ? "needs_review" : "completed";

  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { error: sessionError } = await db
    .from("voice_sessions")
    .update({
      status,
      transcript: fullTranscript,
      extracted_data: extractedProfile,
      duration_seconds: durationSeconds,
    })
    .eq("id", sessionId);

  if (sessionError) {
    throw new DatabaseError("Failed to finalize voice session", { sessionId }, sessionError);
  }

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error: profileError } = await adminDb
    .from("profiles")
    .update({
      voice_session_data: extractedProfile,
      onboarding_status: "voice_complete",
      full_name: extractedProfile.full_name,
      nationality: extractedProfile.nationality,
      current_country: extractedProfile.current_country,
      occupation: extractedProfile.occupation,
      years_experience: extractedProfile.years_experience,
      has_degree: extractedProfile.has_degree,
      degree_level: extractedProfile.degree_level,
      degree_field: extractedProfile.degree_field,
      annual_salary_gbp: extractedProfile.annual_salary_gbp,
      has_criminal_record: extractedProfile.has_criminal_record,
      english_level: extractedProfile.english_level,
      marital_status: extractedProfile.marital_status,
      has_dependents: extractedProfile.has_dependents,
    })
    .eq("id", profileId);

  if (profileError) {
    throw new DatabaseError(
      "Failed to update profile after voice session",
      { profileId },
      profileError
    );
  }

  log.info({ action: "voice.session.finalized", sessionId, profileId, status });
}

/**
 * Streaming version of processConversationTurn.
 * Yields audio chunks as soon as each sentence is ready, then a final meta event.
 */
export async function* streamConversationTurn(
  sessionId: string,
  profileId: string,
  transcript: string,
  history: Message[],
  sessionStartMs: number,
  log: Logger
): AsyncGenerator<TurnStreamEvent> {
  log.info({ action: "voice.turn.stream.start", sessionId });

  // Opening turn — return hardcoded greeting immediately, no Claude call needed
  if (!transcript.trim() && history.length === 0) {
    log.info({ action: "voice.turn.greeting", sessionId });
    const audioBase64 = await textToSpeech(OPENING_GREETING);
    yield {
      type: "audio" as const,
      index: 0,
      audioBase64,
      sentence: OPENING_GREETING,
    };
    yield {
      type: "meta" as const,
      message: OPENING_GREETING,
      complete: false,
      delta: {},
      requires_review: [],
    };
    return;
  }

  const db = createSupabaseServerClient() as unknown as SupabaseClient;

  const { data: session, error: sessionError } = await db
    .from("voice_sessions")
    .select("id, profile_id, extracted_data, transcript")
    .eq("id", sessionId)
    .eq("profile_id", profileId)
    .single();

  if (sessionError || !session) {
    throw new DatabaseError(
      "Voice session not found or access denied",
      { sessionId },
      sessionError ?? undefined
    );
  }

  const sessionRow = session as {
    id: string;
    profile_id: string;
    extracted_data: unknown;
    transcript: string | null;
  };

  const currentPartial = (sessionRow.extracted_data ?? {}) as PartialExtractedProfile;
  const currentTranscript = sessionRow.transcript ?? "";

  // Build message list for Claude — cap history at 20 messages to prevent context overflow
  const truncatedHistory = history.slice(-20);
  const userTurn: Anthropic.MessageParam[] = transcript.trim()
    ? [{ role: "user", content: transcript }]
    : [];

  const messages: Anthropic.MessageParam[] = [
    ...truncatedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.role === "assistant" && !m.content.trimStart().startsWith('{')
        ? JSON.stringify({ message: m.content, delta: {}, complete: false, requires_review: [] })
        : m.content,
    })),
    ...userTurn,
  ];

  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }

  // Build collected-fields context to prevent re-asking after history truncation
  const collectedFields = Object.entries(currentPartial as Record<string, unknown>)
    .filter(([k, v]) => v !== null && v !== undefined && k !== 'requires_review')
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join('\n');

  const systemWithContext = collectedFields.length > 0
    ? `${CLAUDE_SYSTEM_PROMPT}\n\n## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN\n${collectedFields}`
    : CLAUDE_SYSTEM_PROMPT;

  // Stream Claude tokens and accumulate full text
  let fullText = "";
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    temperature: 0,
    system: systemWithContext,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
    }
  }

  // Parse and validate the complete Claude response
  const cleaned = fullText
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  let parsedJson: unknown = undefined;
  let parseError = false;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    parseError = true;
  }

  let turnResponse: TurnResponse;
  if (parseError) {
    if (cleaned.length === 0) {
      log.error({ action: "voice.turn.parse.error", sessionId, raw: cleaned.slice(0, 500) });
      yield { type: "error" as const, message: "Empty response from AI" };
      log.info({ action: "voice.turn.stream.complete", sessionId, complete: false, sentences: 0 });
      return;
    }
    // Attempt to recover embedded JSON from a prose-wrapped response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const recovered = JSON.parse(jsonMatch[0]);
        turnResponse = TurnResponseSchema.parse(recovered);
        log.warn({ action: "voice.turn.json.embedded.recovered", sessionId, snippet: cleaned.slice(0, 100) });
      } catch {
        turnResponse = { message: cleaned.trim(), delta: {} as TurnResponse["delta"], complete: false, requires_review: [] };
        log.warn({ action: "voice.turn.plaintext.fallback", sessionId, raw: cleaned.slice(0, 200) });
      }
    } else {
      turnResponse = { message: cleaned.trim(), delta: {} as TurnResponse["delta"], complete: false, requires_review: [] };
      log.warn({ action: "voice.turn.plaintext.fallback", sessionId, raw: cleaned.slice(0, 200) });
    }
  } else {
    // Coerce numeric fields that Claude may return as strings
    if (typeof parsedJson === 'object' && parsedJson !== null) {
      const p = parsedJson as Record<string, unknown>;
      if (p.delta && typeof p.delta === 'object' && p.delta !== null) {
        const d = p.delta as Record<string, unknown>;
        if (d.years_experience !== undefined && d.years_experience !== null) {
          const coerced = parseInt(String(d.years_experience), 10);
          d.years_experience = isNaN(coerced) ? null : coerced;
        }
        if (d.annual_salary_gbp !== undefined && d.annual_salary_gbp !== null) {
          const coerced = parseInt(String(d.annual_salary_gbp), 10);
          d.annual_salary_gbp = isNaN(coerced) ? null : coerced;
        }
      }
    }
    const validated = TurnResponseSchema.safeParse(parsedJson);
    if (!validated.success) {
      log.error({ action: "voice.turn.validation.error", sessionId, errors: validated.error.errors.map((e) => e.message) });
      yield { type: "error" as const, message: "Response validation failed" };
      log.info({ action: "voice.turn.stream.complete", sessionId, complete: false, sentences: 0 });
      return;
    }
    turnResponse = validated.data;
  }

  if (!turnResponse.message || turnResponse.message.trim().length === 0) {
    log.warn({ action: "voice.turn.empty.message", sessionId });
    yield { type: "error" as const, message: "Empty response" };
    log.info({ action: "voice.turn.stream.complete", sessionId, complete: false, sentences: 0 });
    return;
  }

  // Fire all TTS requests in parallel, yield results in sentence order
  const sentences = splitIntoSentences(turnResponse.message);

  if (sentences.length === 0) {
    log.warn({ action: "voice.turn.no.sentences", sessionId });
    yield { type: "error" as const, message: "No sentences" };
    log.info({ action: "voice.turn.stream.complete", sessionId, complete: false, sentences: 0 });
    return;
  }

  const ttsResults = await Promise.all(
    sentences.map(async (sentence, index): Promise<{ index: number; audioBase64: string | null; sentence: string; error: string | null }> => {
      try {
        const audioBase64 = await textToSpeech(sentence);
        return { index, audioBase64, sentence, error: null };
      } catch (err) {
        return { index, audioBase64: null, sentence, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  for (const result of ttsResults) {
    if (result.error !== null) {
      log.error({ action: "voice.turn.tts.error", sessionId, index: result.index, error: result.error });
      yield { type: "error" as const, message: "Audio generation failed" };
      log.info({ action: "voice.turn.stream.complete", sessionId, complete: false, sentences: 0 });
      return;
    }
    yield {
      type: "audio" as const,
      index: result.index,
      audioBase64: result.audioBase64!,
      sentence: result.sentence,
    };
  }

  // Persist updated session state
  const updatedPartial = mergeDelta(
    currentPartial,
    turnResponse.delta,
    turnResponse.requires_review
  );

  const updatedTranscript =
    currentTranscript +
    (currentTranscript ? "\n" : "") +
    (transcript.trim() ? `User: ${transcript}\n` : "") +
    `Agent: ${turnResponse.message}`;

  const { error: updateError } = await db
    .from("voice_sessions")
    .update({ extracted_data: updatedPartial, transcript: updatedTranscript })
    .eq("id", sessionId);

  if (updateError) {
    throw new DatabaseError("Failed to update voice session", { sessionId }, updateError);
  }

  if (turnResponse.complete) {
    const durationSeconds = Math.round((Date.now() - sessionStartMs) / 1000);
    await finalizeVoiceSession(
      sessionId,
      profileId,
      buildFinalProfile(updatedPartial),
      updatedTranscript,
      durationSeconds,
      log
    );
  }

  yield {
    type: "meta" as const,
    message: turnResponse.message,
    complete: turnResponse.complete,
    delta: turnResponse.delta,
    requires_review: turnResponse.requires_review,
  };

  log.info({
    action: "voice.turn.stream.complete",
    sessionId,
    complete: turnResponse.complete,
    sentences: sentences.length,
  });
}

/** Validate an extracted profile object against the Zod schema. */
export function validateExtractedProfile(data: unknown): VoiceExtractedProfile {
  const result = VoiceExtractedProfileSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid extracted profile", {
      errors: result.error.errors.map((e) => e.message),
    });
  }
  return result.data;
}

/** Apply user-edited review corrections, then set onboarding_status = 'complete'. */
export async function confirmVoiceProfile(
  profileId: string,
  updates: ConfirmRequest["updates"],
  log: Logger
): Promise<void> {
  log.info({ action: "voice.confirm.start", profileId });

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error } = await adminDb
    .from("profiles")
    .update({ ...updates, onboarding_status: "complete" })
    .eq("id", profileId);

  if (error) {
    throw new DatabaseError("Failed to confirm voice profile", { profileId }, error);
  }

  log.info({ action: "voice.confirm.done", profileId });
}
