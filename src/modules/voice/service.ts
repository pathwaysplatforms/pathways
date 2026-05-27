import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ValidationError, DatabaseError } from "@/lib/errors";
import { TurnResponseSchema, VoiceExtractedProfileSchema, ConfirmRequestSchema } from "./types";
import type { TurnResponse, VoiceExtractedProfile, Message, PartialExtractedProfile, ConfirmRequest } from "./types";

const OPENING_GREETING =
  "Hi! I'm your Pathways assistant. I'll help you find the best Canadian immigration pathway for your situation. " +
  "To get started, could you tell me your full name?";

const CLAUDE_SYSTEM_PROMPT = `You are the onboarding assistant for Pathways, an AI-powered Canadian immigration guidance platform.
Your job is to collect the following information through a natural, friendly conversation.
You are NOT a lawyer. You do not give legal advice.

If the user speaks or writes in French, respond entirely in French.

FIELDS TO COLLECT (collect them in this order, but adapt naturally to the conversation):
1. full_name — their full legal name
2. date_of_birth — year, month, day (ask for full date of birth, e.g. "May 15th, 1994")
3. nationality — their country of citizenship (may have multiple — collect all)
4. current_country — where they currently live
5. marital_status — single / married / common-law / separated / divorced / widowed
6. spouse_coming_to_canada — if married/common-law: is their partner also planning to move to Canada? (boolean)
7. education_level_voice — highest degree (e.g. "Master's in Computer Science from University of Delhi")
8. years_experience — total years of skilled work experience in their field (integer)
9. has_canadian_experience — have they ever worked in Canada? (boolean)
10. occupation — their current or most recent job title
11. language_proficiency_self — their English and/or French level: native / fluent / advanced / intermediate / basic
12. has_family_in_canada — do they have any family members currently living in Canada? (boolean)
13. intended_province — do they have a preference for a specific Canadian province? (or "no preference" → output null)
14. annual_income — approximate annual salary as a number
15. income_currency — the currency for that salary (e.g. USD, GBP, EUR, INR, CAD). Ask explicitly: "And which currency is that in?"

IMPORTANT RULES:
- Ask ONE question at a time. Never combine two questions in the same turn.
- Do NOT ask about IELTS/CELPIP scores, NOC codes, CLB levels, or ECA certificates. These are collected later.
- Do NOT ask about spouse's education or language scores. These are collected later.
- If a user seems uncertain, reassure them that approximate answers are fine at this stage.
- For spouse_coming_to_canada: only ask if marital_status is married or common-law.
- For income_currency: always ask separately after getting the income number.
- When all fields are collected, confirm by summarising what you heard and asking if everything is correct.
- When the user confirms everything is correct, set "complete": true in the final PROFILE_DELTA.

PROFILE_DELTA EXTRACTION:
After EVERY turn where the user provides information, you MUST append a JSON block at the very end of your response in this exact format:
<PROFILE_DELTA>{"field_name": value, ...}</PROFILE_DELTA>

Rules for the delta:
- Include ONLY fields extracted in THIS turn. Do not repeat already-collected fields.
- Boolean fields: output true or false (not strings).
- years_experience, annual_income: output as integers.
- date_of_birth: output as "YYYY-MM-DD" string.
- language_proficiency_self: must be exactly one of: native, fluent, advanced, intermediate, basic.
- intended_province: output null if no preference.
- income_currency: output ISO 4217 code (USD, GBP, EUR, INR, CAD, AUD, PHP, NGN, PKR, etc.).
- When all fields are collected AND the user confirms, include "complete": true.
- If a field is unclear, add it to "requires_review": ["field_name"].

CORRECT example (user answered name):
Hi! I'm happy to help you navigate your Canadian immigration journey.
<PROFILE_DELTA>{"full_name": "Priya Sharma"}</PROFILE_DELTA>

CORRECT example (meta-request — user asked to repeat):
I was asking about your level of English — would you say you are a native speaker, fluent, or perhaps advanced?
<PROFILE_DELTA>{}</PROFILE_DELTA>

CORRECT example (final confirmation turn):
Everything looks great! I have all the information I need. We'll now match you to the best Canadian immigration pathways.
<PROFILE_DELTA>{"complete": true}</PROFILE_DELTA>`;

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Parse a Claude response that uses the PROFILE_DELTA tag format.
 * Returns the message text and the parsed delta fields.
 */
function parseProfileDeltaResponse(fullText: string): {
  message: string;
  delta: TurnResponse["delta"];
  complete: boolean;
  requires_review: string[];
} {
  const tagMatch = fullText.match(/<PROFILE_DELTA>([\s\S]*?)<\/PROFILE_DELTA>/);

  if (!tagMatch) {
    return {
      message: fullText.trim(),
      delta: {},
      complete: false,
      requires_review: [],
    };
  }

  const message = fullText.replace(/<PROFILE_DELTA>[\s\S]*?<\/PROFILE_DELTA>/, "").trim();

  let rawDelta: Record<string, unknown> = {};
  try {
    rawDelta = JSON.parse(tagMatch[1]) as Record<string, unknown>;
  } catch {
    return { message, delta: {}, complete: false, requires_review: [] };
  }

  const complete = rawDelta.complete === true;
  const requires_review = Array.isArray(rawDelta.requires_review)
    ? (rawDelta.requires_review as string[])
    : [];

  // Strip control keys; coerce numeric and boolean fields
  const { complete: _c, requires_review: _r, ...fieldData } = rawDelta;
  const typed = fieldData as Record<string, unknown>;

  if (typed.years_experience !== undefined && typed.years_experience !== null) {
    const n = parseInt(String(typed.years_experience), 10);
    typed.years_experience = isNaN(n) ? null : n;
  }
  if (typed.annual_income !== undefined && typed.annual_income !== null) {
    const n = parseInt(String(typed.annual_income), 10);
    typed.annual_income = isNaN(n) ? null : n;
  }

  const validated = TurnResponseSchema.shape.delta.safeParse(typed);
  const delta: TurnResponse["delta"] = validated.success ? validated.data : {};

  return { message, delta, complete, requires_review };
}

/** Call Claude API synchronously (used in non-streaming path). */
async function callClaude(
  history: Message[],
  newTranscript: string,
  collectedFields: string
): Promise<TurnResponse> {
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

  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }

  const systemWithContext = collectedFields
    ? `${CLAUDE_SYSTEM_PROMPT}\n\n## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN\n${collectedFields}`
    : CLAUDE_SYSTEM_PROMPT;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    temperature: 0,
    system: systemWithContext,
    messages,
  });

  const content = response.content[0];
  if (!content || content.type !== "text") {
    throw new ValidationError("Unexpected Claude response type");
  }

  const parsed = parseProfileDeltaResponse(content.text);
  return parsed;
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
    date_of_birth: partial.date_of_birth ?? null,
    nationality: partial.nationality ?? null,
    current_country: partial.current_country ?? null,
    marital_status: partial.marital_status ?? null,
    spouse_coming_to_canada: partial.spouse_coming_to_canada ?? null,
    education_level_voice: partial.education_level_voice ?? null,
    years_experience: partial.years_experience ?? null,
    has_canadian_experience: partial.has_canadian_experience ?? null,
    occupation: partial.occupation ?? null,
    language_proficiency_self: partial.language_proficiency_self ?? null,
    has_family_in_canada: partial.has_family_in_canada ?? null,
    intended_province: partial.intended_province ?? null,
    annual_income: partial.annual_income ?? null,
    income_currency: partial.income_currency ?? null,
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

/** Look up an existing in-progress session for the given profile. */
export async function findExistingSession(
  profileId: string,
  log: Logger
): Promise<{ sessionId: string; history: Message[]; partialProfile: PartialExtractedProfile } | null> {
  log.info({ action: "voice.session.resume.check", profileId });

  const db = createSupabaseServerClient() as unknown as SupabaseClient;
  const { data } = await db
    .from("voice_sessions")
    .select("id, transcript, extracted_data")
    .eq("profile_id", profileId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  const row = data as {
    id: string;
    transcript: string | null;
    extracted_data: unknown;
  };

  const lines = (row.transcript ?? "").split("\n").filter(Boolean);
  const history: Message[] = lines.map((line) => {
    const isUser = line.startsWith("User: ");
    return {
      role: (isUser ? "user" : "assistant") as "user" | "assistant",
      content: isUser ? line.slice(6) : line.startsWith("Agent: ") ? line.slice(7) : line,
    };
  });

  log.info({ action: "voice.session.resume.found", sessionId: row.id });
  return {
    sessionId: row.id,
    history,
    partialProfile: (row.extracted_data ?? {}) as PartialExtractedProfile,
  };
}

/**
 * Split text into speakable sentence chunks.
 * Keeps punctuation attached to the preceding sentence.
 */
function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return raw.map((s) => s.trim()).filter((s) => s.length > 0);
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

/** Process one conversation turn (non-streaming): call Claude, merge delta, TTS, optionally finalize. */
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

  const collectedFields = Object.entries(currentPartial as Record<string, unknown>)
    .filter(([k, v]) => v !== null && v !== undefined && k !== "requires_review")
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const turnResponse = await callClaude(history, transcript, collectedFields);

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
      onboarding_step: "voice_complete",
      onboarding_method: "voice",
      full_name: extractedProfile.full_name,
      nationality: extractedProfile.nationality,
      current_country: extractedProfile.current_country,
      occupation: extractedProfile.occupation,
      years_experience: extractedProfile.years_experience,
      marital_status: extractedProfile.marital_status,
      date_of_birth: extractedProfile.date_of_birth,
      income_currency: extractedProfile.income_currency,
      intended_province: extractedProfile.intended_province,
      has_canadian_experience: extractedProfile.has_canadian_experience,
      language_proficiency_self: extractedProfile.language_proficiency_self,
      has_family_in_canada: extractedProfile.has_family_in_canada,
      education_level_voice: extractedProfile.education_level_voice,
      spouse_coming_to_canada: extractedProfile.spouse_coming_to_canada,
      annual_income: extractedProfile.annual_income,
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

  const truncatedHistory = history.slice(-20);
  const userTurn: Anthropic.MessageParam[] = transcript.trim()
    ? [{ role: "user", content: transcript }]
    : [];

  const messages: Anthropic.MessageParam[] = [
    ...truncatedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    ...userTurn,
  ];

  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }

  const collectedFields = Object.entries(currentPartial as Record<string, unknown>)
    .filter(([k, v]) => v !== null && v !== undefined && k !== "requires_review")
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const systemWithContext = collectedFields
    ? `${CLAUDE_SYSTEM_PROMPT}\n\n## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN\n${collectedFields}`
    : CLAUDE_SYSTEM_PROMPT;

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

  if (!fullText.trim()) {
    log.error({ action: "voice.turn.empty.response", sessionId });
    yield { type: "error" as const, message: "Empty response from AI" };
    return;
  }

  const { message, delta, complete, requires_review } = parseProfileDeltaResponse(fullText);

  if (!message) {
    log.warn({ action: "voice.turn.empty.message", sessionId });
    yield { type: "error" as const, message: "Empty message from AI" };
    return;
  }

  const sentences = splitIntoSentences(message);
  if (sentences.length === 0) {
    yield { type: "error" as const, message: "No speakable sentences" };
    return;
  }

  const ttsResults = await Promise.all(
    sentences.map(async (sentence, index) => {
      try {
        const audioBase64 = await textToSpeech(sentence);
        return { index, audioBase64, sentence, error: null };
      } catch (err) {
        return {
          index,
          audioBase64: null,
          sentence,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  for (const result of ttsResults) {
    if (result.error !== null) {
      log.error({ action: "voice.turn.tts.error", sessionId, index: result.index, error: result.error });
      yield { type: "error" as const, message: "Audio generation failed" };
      return;
    }
    yield {
      type: "audio" as const,
      index: result.index,
      audioBase64: result.audioBase64!,
      sentence: result.sentence,
    };
  }

  const updatedPartial = mergeDelta(currentPartial, delta, requires_review);

  const updatedTranscript =
    currentTranscript +
    (currentTranscript ? "\n" : "") +
    (transcript.trim() ? `User: ${transcript}\n` : "") +
    `Agent: ${message}`;

  const { error: updateError } = await db
    .from("voice_sessions")
    .update({ extracted_data: updatedPartial, transcript: updatedTranscript })
    .eq("id", sessionId);

  if (updateError) {
    throw new DatabaseError("Failed to update voice session", { sessionId }, updateError);
  }

  if (complete) {
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
    message,
    complete,
    delta,
    requires_review,
  };

  log.info({
    action: "voice.turn.stream.complete",
    sessionId,
    complete,
    sentences: sentences.length,
  });
}

/** Validate an extracted profile object against the Zod schema. */
export function validateExtractedProfile(data: unknown): VoiceExtractedProfile {
  const result = VoiceExtractedProfileSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid extracted profile", {
      errors: result.error.errors.map((err: { message: string }) => err.message),
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
