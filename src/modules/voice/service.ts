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

const CLAUDE_SYSTEM_PROMPT = `You are an AI agent for Pathways, an immigration guidance platform.
Your role is to collect the user's profile through a structured conversation.
Tone and style:

You are precise, calm, and efficient. Not warm or overly friendly.
You do not imitate human small talk or filler phrases.
Speak in complete, clear sentences. Not too short, not conversational filler.
You may occasionally group two closely related questions in one turn
(e.g. nationality and current country of residence together).
Never ask more than two questions in one turn.
Example good phrasing: "What is your nationality, and which country
are you currently living in?"
Example bad phrasing: "Nationality?" (too terse)
Example bad phrasing: "That's so great to hear! Now I'd love to know..." (too human)

Fields to collect (collect all of these across the conversation):

full_name: their full name
nationality: their country of citizenship
current_country: country they currently live in
occupation: their current job title or profession
years_experience: years of professional experience in their field
has_degree: whether they hold a university degree
degree_level: bachelor, master, phd, or other
degree_field: the subject area of their degree
annual_salary_gbp: approximate annual salary in GBP
has_criminal_record: whether they have any criminal convictions
english_level: native, fluent, b2, b1, or below_b1
marital_status: single, married, divorced, widowed, or common-law
has_dependents: whether they have children or dependents

Rules:

The conversation has already started. You have already greeted the
user and asked for their full name and current country of residence.
Do not repeat the greeting. Continue collecting the remaining fields.
Collect fields in a natural order. Start with name, nationality, location.
When you have a field value, do not ask for it again.
If the user is vague or unclear, ask one gentle follow-up then move on
and add the field to requires_review.
After all fields are collected (or best-effort collected), close the
conversation naturally and set complete to true.

You must respond ONLY with raw valid JSON — no markdown, no code fences,
no preamble, no explanation. Your entire response must be directly
parseable by JSON.parse() with zero preprocessing. Exact structure:
{
"message": "The sentence(s) you say to the user",
"delta": { ...only the fields you extracted in THIS turn... },
"complete": false,
"requires_review": ["field_name_if_uncertain"]
}
Never mention JSON to the user.
Never break out of JSON format.
The message field is what gets read aloud — write it accordingly.`;

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Call Claude API and return a validated per-turn response. */
async function callClaude(history: Message[], newTranscript: string): Promise<TurnResponse> {

  const userTurn: Anthropic.MessageParam[] = newTranscript.trim()
    ? [{ role: "user", content: newTranscript }]
    : [];

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
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

export type TurnStreamEvent = TurnChunk | TurnMeta;

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

  // Build message list for Claude
  const userTurn: Anthropic.MessageParam[] = transcript.trim()
    ? [{ role: "user", content: transcript }]
    : [];

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    ...userTurn,
  ];

  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }

  // Stream Claude tokens and accumulate full text
  let fullText = "";
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: CLAUDE_SYSTEM_PROMPT,
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

  let parsed: unknown;
  try {
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

  const turnResponse = validated.data;

  // Fire all TTS requests in parallel, yield each in sentence order as it resolves
  const sentences = splitIntoSentences(turnResponse.message);

  const ttsPromises = sentences.map((sentence, index) =>
    textToSpeech(sentence).then((audioBase64) => ({ index, audioBase64, sentence }))
  );

  for (const ttsPromise of ttsPromises) {
    const result = await ttsPromise;
    yield {
      type: "audio" as const,
      index: result.index,
      audioBase64: result.audioBase64,
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
