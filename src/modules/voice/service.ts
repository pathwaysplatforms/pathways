import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Logger } from "pino";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ValidationError, DatabaseError } from "@/lib/errors";
import { TurnResponseSchema, VoiceExtractedProfileSchema, ConfirmRequestSchema } from "./types";
import type { TurnResponse, VoiceExtractedProfile, Message, PartialExtractedProfile, ConfirmRequest } from "./types";
import { computeProfileCompletenessPct } from "@/lib/completeness";
import { buildPathwayInput } from "@/lib/pathway-input";
import {
  ALL_VISA_TYPES,
  survivingPathways,
  pickNextQuestion,
  scorePathways,
  updateMatcher,
  profileToAnswers,
  initialMatcherState,
} from "./matcher-engine";
import type { MatcherState, VisaType } from "./matcher-engine";

const OPENING_GREETING =
  "Hi! I'm your Pathways assistant. I'll ask you a few questions to find the best Canadian immigration pathway for your situation — it takes about 3 minutes. To get started, could you tell me your full name?";

const VOICE_SYSTEM_PROMPT = `You are the onboarding assistant for Pathways, an AI-powered Canadian immigration guidance platform. Your job is to learn about the user through a warm, natural conversation so we can identify which Canadian immigration pathway fits them best.

You are NOT a lawyer. Never give legal advice or guarantee any outcome.

LANGUAGE: If the user speaks or writes in French at any point, switch entirely to French and stay in French for the rest of the conversation.

YOUR GOAL: Collect the following fields through natural conversation. Do not make it feel like a form — ask follow-up questions naturally, show genuine curiosity, and acknowledge what they share.

FIELDS TO COLLECT (suggested order, adapt naturally):
1. full_name — their full name
2. date_of_birth — full date (day, month, year)
3. nationality — country or countries of citizenship
4. current_country — where they currently live
5. marital_status — single / married / common-law / separated / divorced / widowed
6. occupation — current or most recent job title; infer noc_teer_category silently (see TEER INFERENCE below)
7. years_experience — total years of skilled work experience
8. canadian_work_years / foreign_work_years — ask "Has any of that work been inside Canada?" If yes, how many years and whether any in the last 3 years (canadian_work_recent). foreign_work_years = years_experience − canadian_work_years.
9. education_level_voice — highest education (degree name + field). Also map to education_level silently.
10. eca_obtained — if they mention a foreign degree, ask if they've had credentials assessed by WES or equivalent. Skip if they studied in Canada.
11. language_proficiency_self — English/French level: native / fluent / advanced / intermediate / basic
12. CLB scores — ask if they've taken IELTS, CELPIP, TEF, or TCF. If yes, get their scores and convert to CLB (see CLB CONVERSION below). If no, map from language_proficiency_self.
13. has_family_in_canada — any family members in Canada?
14. intended_province — province preference or no preference
15. Spouse section (only if marital_status is married or common-law):
    - spouse_coming_to_canada — will their partner also move to Canada?
    - One question only: "Will your partner be immigrating with you?" That's all voice needs.
16. Bonus factors (ask as one grouped question near the end):
    "A couple of final questions — do you have a job offer from a Canadian employer, or a provincial nomination?"
    Extract: has_canadian_job_offer, has_provincial_nomination. All default false.

TEER INFERENCE (infer silently from occupation — never ask for a NOC number):
- TEER 0: Senior managers, executives, directors, C-suite
- TEER 1: Engineers, doctors, lawyers, architects, IT professionals, accountants, scientists, nurses, pharmacists
- TEER 2: Technologists, paralegals, chefs, pilots, dental hygienists
- TEER 3: Electricians, plumbers, early childhood educators, retail supervisors, carpenters
- TEER 4: Home support workers, truck drivers, administrative assistants, food counter workers
- TEER 5: Labourers, food service workers, cleaners, farm workers
If ambiguous (e.g. "manager" without context, "consultant" without a field), ask one follow-up: "Is that a senior leadership role, or more of a hands-on technical position?" Add noc_teer_category to requires_review if still unclear.

CLB CONVERSION (IELTS General → CLB):
- Band 8.0–9.0 → CLB 10
- Band 7.0–7.5 → CLB 9
- Band 6.0–6.5 → CLB 8
- Band 5.5 → CLB 7
- Band 5.0 → CLB 6
- Band 4.0–4.5 → CLB 5
- Below 4.0 → CLB 4
Apply the same mapped value to all four CLB fields (speaking, listening, reading, writing) unless the user gives individual sub-scores.
If no test taken, map from language_proficiency_self: native→10, fluent→9, advanced→8, intermediate→7, basic→5.

EDUCATION LEVEL MAPPING (map silently from what they said — only ask if unclear):
- bachelor/undergraduate → bachelors
- master/MBA/MSc → masters
- PhD/doctorate → phd
- diploma / 2-year college → two_year_post_secondary
- 1-year certificate → one_year_post_secondary
- high school / secondary → secondary
- less than high school → less_than_secondary
- two or more credentials → two_or_more_credentials
If degree_level is "other" or unclear, ask one follow-up question.

STRICT RULES:
- Ask one question per turn; combine two or three closely related fields when it flows naturally.
- Keep responses short — 1 to 3 sentences max. This is a voice conversation.
- Never ask for CLB numbers directly — convert from the test the user took.
- Never ask for a NOC code — infer TEER from occupation.
- When a user gives an approximate answer (e.g. "around 5 years"), accept it and move on.
- After collecting all fields, give a brief warm summary and ask: "Does that all sound right?"
- When the user confirms, set complete: true in your PROFILE_DELTA.

DATA EXTRACTION RULES:
- clb_*: integer 0–12. Map from IELTS/CELPIP/TEF/TCF scores using table above. Apply same value to all four fields unless individual scores are given.
- canadian_work_years: integer, 0 if no Canadian experience. foreign_work_years = years_experience − canadian_work_years.
- canadian_work_recent: true if any Canadian experience in last 3 years.
- foreign_work_recent: true if foreign experience within last 10 years.
- noc_teer_category: infer silently. Add to requires_review if still unclear after one follow-up.
- education_level: map silently. Only ask if degree_level is null or "other".
- has_provincial_nomination, has_canadian_job_offer: both default false. Set true only if explicitly mentioned.
- spouse_coming_to_canada: only collect if marital_status is married or common-law.

PROFILE_DELTA EXTRACTION:
After EVERY turn where the user provides any information, you MUST append a structured block at the very end of your response (after your conversational text) in this exact format:

<PROFILE_DELTA>
{"field_name": "value"}
</PROFILE_DELTA>

Rules for PROFILE_DELTA:
- Only include fields the user just provided or that you inferred in this turn
- Use snake_case field names exactly as listed above
- For booleans: use true or false (not "yes"/"no")
- For date_of_birth: use "YYYY-MM-DD" format
- For marital_status: use one of: "single", "married", "common_law", "separated", "divorced", "widowed"
- For language_proficiency_self: use one of: "native", "fluent", "advanced", "intermediate", "basic"
- For education_level: use one of: "less_than_secondary", "secondary", "one_year_post_secondary", "two_year_post_secondary", "bachelors", "two_or_more_credentials", "masters", "phd"
- CLB fields: integer 0–12
- noc_teer_category: integer 0–5
- When all fields are confirmed: include "complete": true in the delta
- If the user provides no extractable information (e.g. asks a question back), emit an empty delta: <PROFILE_DELTA>{}</PROFILE_DELTA>

OPENING MESSAGE:
Start with exactly this (in the user's language): "Hi! I'm your Pathways assistant. I'll ask you a few questions to find the best Canadian immigration pathway for your situation — it takes about 3 minutes. To get started, could you tell me your full name?"

CORRECT example (user answered name):
Hi [name], great to meet you!
<PROFILE_DELTA>{"full_name": "Priya Sharma"}</PROFILE_DELTA>

CORRECT example (occupation inferred to TEER 1):
That's great — software engineers are very well positioned for Express Entry!
<PROFILE_DELTA>{"occupation": "software engineer", "noc_teer_category": 1}</PROFILE_DELTA>

CORRECT example (meta-request — user asked to repeat):
I was asking about your level of English — would you say you are a native speaker, fluent, or perhaps advanced?
<PROFILE_DELTA>{}</PROFILE_DELTA>

CORRECT example (final confirmation turn):
Everything looks great! I have all the information I need. We'll now match you to the best Canadian immigration pathways.
<PROFILE_DELTA>{"complete": true}</PROFILE_DELTA>`;

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Extract the JSON object from between PROFILE_DELTA tags using brace-counting. */
function extractProfileDeltaJson(text: string): Record<string, unknown> | null {
  const openTag = "<PROFILE_DELTA>";
  const closeTag = "</PROFILE_DELTA>";
  const tagStart = text.indexOf(openTag);
  if (tagStart === -1) return null;

  const jsonStart = tagStart + openTag.length;
  let depth = 0;
  let i = jsonStart;
  while (i < text.length) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }

  const braceJson = text.slice(jsonStart, i + 1).trim();
  try {
    return JSON.parse(braceJson) as Record<string, unknown>;
  } catch {
    const closeIdx = text.indexOf(closeTag, jsonStart);
    if (closeIdx === -1) return null;
    try {
      return JSON.parse(text.slice(jsonStart, closeIdx).trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

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
  const hasTag = fullText.includes("<PROFILE_DELTA>");
  const rawDelta = extractProfileDeltaJson(fullText);

  if (!hasTag || rawDelta === null) {
    return {
      message: fullText.trim(),
      delta: {},
      complete: false,
      requires_review: [],
    };
  }

  const message = fullText.replace(/<PROFILE_DELTA>[\s\S]*?<\/PROFILE_DELTA>/, "").trim();

  const complete = rawDelta.complete === true;
  const requires_review = Array.isArray(rawDelta.requires_review)
    ? (rawDelta.requires_review as string[])
    : [];

  // Strip control keys; coerce numeric and boolean fields
  const { complete: _c, requires_review: _r, ...fieldData } = rawDelta;
  const typed = fieldData as Record<string, unknown>;

  const integerFields = [
    "years_experience",
    "clb_speaking",
    "clb_listening",
    "clb_reading",
    "clb_writing",
    "canadian_work_years",
    "foreign_work_years",
    "noc_teer_category",
  ] as const;
  for (const field of integerFields) {
    if (typed[field] !== undefined && typed[field] !== null) {
      const n = parseInt(String(typed[field]), 10);
      typed[field] = isNaN(n) ? null : n;
    }
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
    ? `${VOICE_SYSTEM_PROMPT}\n\n## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN\n${collectedFields}`
    : VOICE_SYSTEM_PROMPT;

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

  // Cap at 600 chars — sufficient for all voice turn responses and bounds per-call cost.
  const cappedText = text.slice(0, 600);

  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: cappedText,
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
    education_level_voice: partial.education_level_voice ?? null,
    years_experience: partial.years_experience ?? null,
    has_canadian_experience: partial.has_canadian_experience ?? null,
    occupation: partial.occupation ?? null,
    language_proficiency_self: partial.language_proficiency_self ?? null,
    has_family_in_canada: partial.has_family_in_canada ?? null,
    intended_province: partial.intended_province ?? null,
    clb_speaking: partial.clb_speaking ?? null,
    clb_listening: partial.clb_listening ?? null,
    clb_reading: partial.clb_reading ?? null,
    clb_writing: partial.clb_writing ?? null,
    canadian_work_years: partial.canadian_work_years ?? null,
    foreign_work_years: partial.foreign_work_years ?? null,
    canadian_work_recent: partial.canadian_work_recent ?? null,
    foreign_work_recent: partial.foreign_work_recent ?? null,
    noc_teer_category: partial.noc_teer_category ?? null,
    noc_code: partial.noc_code ?? null,
    education_level: partial.education_level ?? null,
    eca_obtained: partial.eca_obtained ?? null,
    spouse_coming_to_canada: partial.spouse_coming_to_canada ?? null,
    has_provincial_nomination: partial.has_provincial_nomination ?? false,
    has_canadian_job_offer: partial.has_canadian_job_offer ?? false,
    destination_country: partial.destination_country ?? null,
    purpose: partial.purpose ?? null,
    dependents: partial.dependents ?? null,
    requires_review: partial.requires_review ?? [],
  };
}

/** Create a new voice session row and return its ID. */
export async function createVoiceSession(profileId: string, log: Logger): Promise<string> {
  log.info({ action: "voice.session.start", profileId });

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;
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

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;
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

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

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
  log: Logger,
  convergedMatcher?: MatcherState | null
): Promise<void> {
  log.info({ action: "voice.session.finalizing", sessionId, profileId });

  const status = extractedProfile.requires_review.length > 0 ? "needs_review" : "completed";

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;
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

  const profileCompletenessPct = computeProfileCompletenessPct(extractedProfile);

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;
  const { error: profileError } = await adminDb
    .from("profiles")
    .update({
      voice_session_data: extractedProfile,
      onboarding_status: "voice_complete",
      onboarding_step: "voice_complete",
      onboarding_method: "voice",
      profile_completeness_pct: profileCompletenessPct,
      full_name: extractedProfile.full_name,
      nationality: extractedProfile.nationality,
      current_country: extractedProfile.current_country,
      occupation: extractedProfile.occupation,
      years_experience: extractedProfile.years_experience,
      marital_status: extractedProfile.marital_status,
      date_of_birth: extractedProfile.date_of_birth,
      intended_province: extractedProfile.intended_province,
      has_canadian_experience: extractedProfile.has_canadian_experience,
      language_proficiency_self: extractedProfile.language_proficiency_self,
      has_family_in_canada: extractedProfile.has_family_in_canada,
      education_level_voice: extractedProfile.education_level_voice,
      clb_speaking: extractedProfile.clb_speaking,
      clb_listening: extractedProfile.clb_listening,
      clb_reading: extractedProfile.clb_reading,
      clb_writing: extractedProfile.clb_writing,
      canadian_work_years: extractedProfile.canadian_work_years,
      foreign_work_years: extractedProfile.foreign_work_years,
      canadian_work_recent: extractedProfile.canadian_work_recent,
      foreign_work_recent: extractedProfile.foreign_work_recent,
      noc_teer_category: extractedProfile.noc_teer_category,
      noc_code: extractedProfile.noc_code,
      education_level: extractedProfile.education_level,
      eca_obtained: extractedProfile.eca_obtained,
      spouse_coming_to_canada: extractedProfile.spouse_coming_to_canada,
      has_provincial_nomination: extractedProfile.has_provincial_nomination,
      has_canadian_job_offer: extractedProfile.has_canadian_job_offer,
    })
    .eq("id", profileId);

  if (profileError) {
    throw new DatabaseError(
      "Failed to update profile after voice session",
      { profileId },
      profileError
    );
  }

  // When the Akinator matcher has converged, write an early pathway_input_json so the
  // async pipeline can begin processing before the user hits "Confirm" on the review page.
  if (convergedMatcher?.converged && convergedMatcher.scored && convergedMatcher.scored.length > 0) {
    const pathwayInput = buildPathwayInput(
      profileId,
      extractedProfile,
      sessionId,
      "voice",
      { scores: convergedMatcher.scored, convergedAtTurn: convergedMatcher.turnCount }
    );
    const { error: piError } = await adminDb
      .from("profiles")
      .update({ pathway_input_json: pathwayInput as unknown as Record<string, unknown> })
      .eq("id", profileId);
    if (piError) {
      // Non-fatal: confirm route will write it again; just log and continue.
      log.warn({ action: "voice.session.matcher.pathway_input.warn", profileId, error: piError.message });
    } else {
      log.info({
        action: "voice.session.matcher.pathway_input.written",
        profileId,
        topVisaType: convergedMatcher.scored[0]?.visaType,
        surviving: convergedMatcher.surviving.length,
      });
    }
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

  // Guard: empty transcript outside the greeting context is a client bug — fail fast.
  if (!transcript.trim() && history.length > 0) {
    log.warn({ action: "voice.turn.empty.transcript.non-greeting", sessionId });
    yield { type: "error" as const, message: "Transcript is required" };
    return;
  }

  // Opening turn — return hardcoded greeting immediately, no Claude call needed
  if (!transcript.trim() && history.length === 0) {
    log.info({ action: "voice.turn.greeting", sessionId });
    try {
      const audioBase64 = await textToSpeech(OPENING_GREETING);
      yield {
        type: "audio" as const,
        index: 0,
        audioBase64,
        sentence: OPENING_GREETING,
      };
    } catch (ttsErr) {
      log.warn({ action: "voice.turn.tts.skipped", sessionId, sentence: OPENING_GREETING.slice(0, 50), error: String(ttsErr) });
    }
    yield {
      type: "meta" as const,
      message: OPENING_GREETING,
      complete: false,
      delta: {},
      requires_review: [],
    };
    return;
  }

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

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

  const rawExtracted = (sessionRow.extracted_data ?? {}) as Record<string, unknown>;
  const currentPartial = rawExtracted as PartialExtractedProfile;
  const currentTranscript = sessionRow.transcript ?? "";

  // Restore persisted matcher state from extracted_data (underscore-prefixed keys)
  const prevMatcherState: MatcherState = {
    answers: profileToAnswers(currentPartial),
    surviving: (rawExtracted._matcher_surviving as VisaType[] | undefined) ?? [...ALL_VISA_TYPES],
    turnCount: (rawExtracted._matcher_turn_count as number | undefined) ?? 0,
    converged: (rawExtracted._matcher_converged as boolean | undefined) ?? false,
    scored: null,
  };

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

  // Exclude internal matcher keys from the "already collected" context shown to Haiku
  const collectedFields = Object.entries(rawExtracted)
    .filter(([k, v]) => !k.startsWith("_") && v !== null && v !== undefined && k !== "requires_review")
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  // Append the matcher's next-question hint so Haiku prioritises the most discriminating field
  const prevNextQuestion = rawExtracted._matcher_next_question as string | null | undefined;
  let systemWithContext = collectedFields
    ? `${VOICE_SYSTEM_PROMPT}\n\n## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN\n${collectedFields}`
    : VOICE_SYSTEM_PROMPT;
  if (prevNextQuestion) {
    systemWithContext += `\n\nPriority field to establish if not yet known: ${prevNextQuestion}`;
  }

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
      log.warn({ action: "voice.turn.tts.skipped", sessionId, index: result.index, sentence: result.sentence.slice(0, 50), error: result.error });
      continue;
    }
    yield {
      type: "audio" as const,
      index: result.index,
      audioBase64: result.audioBase64!,
      sentence: result.sentence,
    };
  }

  const updatedPartial = mergeDelta(currentPartial, delta, requires_review);

  // Update Akinator matcher from the newly merged profile
  const newMatcherState = updateMatcher(prevMatcherState, updatedPartial);
  const answeredKeys = new Set(Object.keys(newMatcherState.answers) as (keyof typeof newMatcherState.answers)[]);
  const nextQuestion = pickNextQuestion(newMatcherState.surviving, answeredKeys);

  log.info({
    action: "voice.matcher.update",
    sessionId,
    surviving: newMatcherState.surviving.length,
    turnCount: newMatcherState.turnCount,
    converged: newMatcherState.converged,
    nextQuestion,
  });

  const updatedTranscript =
    currentTranscript +
    (currentTranscript ? "\n" : "") +
    (transcript.trim() ? `User: ${transcript}\n` : "") +
    `Agent: ${message}`;

  // Persist profile fields AND matcher metadata (underscore-prefixed) together in extracted_data
  const { error: updateError } = await db
    .from("voice_sessions")
    .update({
      extracted_data: {
        ...updatedPartial,
        _matcher_surviving: newMatcherState.surviving,
        _matcher_turn_count: newMatcherState.turnCount,
        _matcher_converged: newMatcherState.converged,
        _matcher_next_question: nextQuestion ?? null,
        _matcher_scored: newMatcherState.scored ?? null,
      } as unknown as Record<string, unknown>,
      transcript: updatedTranscript,
    })
    .eq("id", sessionId);

  if (updateError) {
    throw new DatabaseError("Failed to update voice session", { sessionId }, updateError);
  }

  if (complete) {
    const durationSeconds = Math.round((Date.now() - sessionStartMs) / 1000);
    const finalProfile = buildFinalProfile(updatedPartial);
    await finalizeVoiceSession(
      sessionId,
      profileId,
      finalProfile,
      updatedTranscript,
      durationSeconds,
      log,
      newMatcherState
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

/**
 * Streaming voice turn for guests — same Claude+TTS pipeline as streamConversationTurn
 * but reads profile state from the request body instead of the database, and does not
 * write to voice_sessions or profiles.  Returns updatedPartial in the meta event so
 * the caller can persist it to guest_sessions.
 */
export async function* streamConversationTurnGuest(
  currentPartial: PartialExtractedProfile,
  transcript: string,
  history: Message[],
  log: Logger
): AsyncGenerator<TurnStreamEvent & { updatedPartial?: PartialExtractedProfile }> {
  const sessionId = "guest";
  log.info({ action: "voice.turn.guest.start" });

  if (!transcript.trim() && history.length > 0) {
    log.warn({ action: "voice.turn.guest.empty.transcript" });
    yield { type: "error" as const, message: "Transcript is required" };
    return;
  }

  if (!transcript.trim() && history.length === 0) {
    log.info({ action: "voice.turn.guest.greeting" });
    try {
      const audioBase64 = await textToSpeech(OPENING_GREETING);
      yield { type: "audio" as const, index: 0, audioBase64, sentence: OPENING_GREETING };
    } catch (err) {
      log.warn({ action: "voice.turn.guest.tts.skipped", error: String(err) });
    }
    yield { type: "meta" as const, message: OPENING_GREETING, complete: false, delta: {}, requires_review: [] };
    return;
  }

  const truncatedHistory = history.slice(-20);
  const userTurn: Anthropic.MessageParam[] = transcript.trim()
    ? [{ role: "user", content: transcript }]
    : [];

  const messages: Anthropic.MessageParam[] = [
    ...truncatedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ...userTurn,
  ];
  if (messages.length === 0) messages.push({ role: "user", content: "Hello" });

  const collectedFields = Object.entries(currentPartial as Record<string, unknown>)
    .filter(([k, v]) => v !== null && v !== undefined && k !== "requires_review")
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join("\n");

  const systemWithContext = collectedFields
    ? `${VOICE_SYSTEM_PROMPT}\n\n## FIELDS ALREADY COLLECTED — DO NOT ASK AGAIN\n${collectedFields}`
    : VOICE_SYSTEM_PROMPT;

  let fullText = "";
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    temperature: 0,
    system: systemWithContext,
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullText += event.delta.text;
    }
  }

  if (!fullText.trim()) {
    yield { type: "error" as const, message: "Empty response from AI" };
    return;
  }

  const { message, delta, complete, requires_review } = parseProfileDeltaResponse(fullText);
  if (!message) {
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
        return { index, audioBase64: null, sentence, error: String(err) };
      }
    })
  );

  for (const result of ttsResults) {
    if (result.error !== null) {
      log.warn({ action: "voice.turn.guest.tts.skipped", index: result.index, error: result.error });
      continue;
    }
    yield { type: "audio" as const, index: result.index, audioBase64: result.audioBase64!, sentence: result.sentence };
  }

  const updatedPartial = mergeDelta(currentPartial, delta, requires_review);

  yield {
    type: "meta" as const,
    message,
    complete,
    delta,
    requires_review,
    updatedPartial,
  };

  log.info({ action: "voice.turn.guest.done", complete, sentences: sentences.length, sessionId });
}

/** Apply user-edited review corrections, then set onboarding_status = 'complete'. */
export async function confirmVoiceProfile(
  profileId: string,
  updates: ConfirmRequest["updates"],
  log: Logger
): Promise<void> {
  log.info({ action: "voice.confirm.start", profileId });

  const adminDb = createSupabaseAdminClient() as unknown as SupabaseClient;

  const { data: currentProfile, error: fetchError } = await adminDb
    .from("profiles")
    .select(
      "full_name,date_of_birth,nationality,current_country,marital_status," +
      "occupation,noc_teer_category,years_experience,canadian_work_years,foreign_work_years," +
      "education_level,eca_obtained,clb_speaking,clb_listening,clb_reading,clb_writing," +
      "intended_province,has_provincial_nomination,has_canadian_job_offer"
    )
    .eq("id", profileId)
    .single();

  if (fetchError || !currentProfile) {
    throw new DatabaseError("Failed to fetch profile for completeness calculation", { profileId }, fetchError ?? undefined);
  }

  const current = currentProfile as Parameters<typeof computeProfileCompletenessPct>[0];
  const mergedForCompleteness = { ...current, ...updates };
  const profileCompletenessPct = computeProfileCompletenessPct(mergedForCompleteness);

  const { error } = await adminDb
    .from("profiles")
    .update({ ...updates, onboarding_status: "complete", profile_completeness_pct: profileCompletenessPct })
    .eq("id", profileId);

  if (error) {
    throw new DatabaseError("Failed to confirm voice profile", { profileId }, error);
  }

  log.info({ action: "voice.confirm.done", profileId });
}
