/**
 * OpenAI embedding wrapper for the pathway matching engine.
 * Uses text-embedding-3-small (1536 dims) via OPENAI_API_KEY.
 *
 * Audit notes:
 *   - openai ^4 is already in package.json
 *   - No prior embeddings utility existed in src/lib/
 *   - Profile-to-text conversion mirrors the language used in official
 *     immigration documents to maximise cosine similarity with pathway chunks
 */

import OpenAI from "openai";
import type { VoiceExtractedProfile } from "@/modules/voice/types";

const EMBEDDING_MODEL = "text-embedding-3-small";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local before running the matching engine."
    );
  }
  return new OpenAI({ apiKey });
}

/** Embed any text string and return a 1536-dimensional vector. */
export async function embedText(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, " "),
  });
  return response.data[0].embedding;
}

/**
 * Convert an immigration profile to a rich natural-language summary,
 * then embed it. The NL form closely mirrors official immigration documents
 * (CLB bands, TEER categories, ECA mentions) so it aligns well with pathway chunks.
 */
export async function embedProfile(
  profile: Partial<VoiceExtractedProfile>
): Promise<number[]> {
  const text = profileToNLSummary(profile);
  return embedText(text);
}

/** Build the natural-language summary used for both embedding and Claude prompts. */
export function profileToNLSummary(
  profile: Partial<VoiceExtractedProfile>
): string {
  const parts: string[] = [];

  // Nationality / location — use raw DOB for stable embedding across days
  const nationality = profile.nationality ?? "Unknown nationality";
  const dobStr = profile.date_of_birth ? `, born ${profile.date_of_birth}` : "";
  parts.push(`${nationality} national${dobStr}.`);

  // Destination / purpose
  const destination = profile.destination_country ?? "Canada";
  parts.push(`Seeking immigration to ${destination}.`);

  // Occupation and work experience
  if (profile.occupation) {
    const teerStr =
      profile.noc_teer_category != null
        ? ` NOC TEER ${profile.noc_teer_category}`
        : "";
    const nocStr = profile.noc_code ? ` (NOC ${profile.noc_code})` : "";
    parts.push(`Current occupation: ${profile.occupation}${nocStr}${teerStr}.`);
  }

  const foreignYears = profile.foreign_work_years ?? 0;
  const canadianYears = profile.canadian_work_years ?? 0;
  if (foreignYears > 0 || canadianYears > 0) {
    const expParts: string[] = [];
    if (foreignYears > 0)
      expParts.push(
        `${foreignYears} year${foreignYears !== 1 ? "s" : ""} of foreign skilled work experience${profile.foreign_work_recent ? " (recent)" : ""}`
      );
    if (canadianYears > 0)
      expParts.push(
        `${canadianYears} year${canadianYears !== 1 ? "s" : ""} of Canadian work experience`
      );
    parts.push(`Work experience: ${expParts.join("; ")}.`);
  } else if (profile.years_experience) {
    parts.push(`Total work experience: ${profile.years_experience} years.`);
  }

  // Education
  if (profile.education_level) {
    const levelMap: Record<string, string> = {
      less_than_secondary: "less than secondary school",
      secondary: "secondary school diploma",
      one_year_post_secondary: "one-year post-secondary certificate",
      two_year_post_secondary: "two-year post-secondary diploma",
      bachelors: "Bachelor's degree",
      two_or_more_credentials: "two or more post-secondary credentials",
      masters: "Master's degree",
      phd: "PhD (doctoral degree)",
    };
    const levelStr = levelMap[profile.education_level] ?? profile.education_level;
    const ecaStr =
      profile.eca_obtained === true
        ? " with ECA/WES evaluation"
        : profile.eca_obtained === false
          ? " (no ECA obtained)"
          : "";
    parts.push(`Education: ${levelStr}${ecaStr}.`);
  } else if (profile.education_level_voice) {
    parts.push(`Education (self-reported): ${profile.education_level_voice}.`);
  }

  // Language proficiency
  const clbScores = [
    profile.clb_listening,
    profile.clb_reading,
    profile.clb_speaking,
    profile.clb_writing,
  ];
  if (clbScores.some((v) => v != null)) {
    const l = profile.clb_listening ?? "?";
    const r = profile.clb_reading ?? "?";
    const s = profile.clb_speaking ?? "?";
    const w = profile.clb_writing ?? "?";
    parts.push(
      `English proficiency (CLB): listening ${l}, reading ${r}, speaking ${s}, writing ${w}.`
    );
  } else if (profile.language_proficiency_self) {
    parts.push(
      `Language proficiency: ${profile.language_proficiency_self} (self-assessed).`
    );
  }

  // Marital status and spouse
  if (profile.marital_status) {
    parts.push(`Marital status: ${profile.marital_status}.`);
  }
  if (profile.spouse_coming_to_canada === true) {
    const spouseParts: string[] = [];
    if (profile.spouse_education_level) spouseParts.push(`education: ${profile.spouse_education_level}`);
    const spouseClb = [
      profile.spouse_clb_listening,
      profile.spouse_clb_reading,
      profile.spouse_clb_speaking,
      profile.spouse_clb_writing,
    ];
    if (spouseClb.some((v) => v != null)) {
      const avg = spouseClb.filter((v): v is number => v != null);
      const avgScore = avg.length
        ? Math.round(avg.reduce((a, b) => a + b, 0) / avg.length)
        : null;
      if (avgScore != null)
        spouseParts.push(`average CLB ${avgScore}`);
    }
    if (profile.spouse_canadian_work_years)
      spouseParts.push(`${profile.spouse_canadian_work_years} years Canadian work experience`);
    const spouseDetail = spouseParts.length ? ` (${spouseParts.join(", ")})` : "";
    parts.push(`Accompanying spouse${spouseDetail}.`);
  } else if (profile.spouse_coming_to_canada === false && profile.marital_status !== "single") {
    parts.push("Spouse not accompanying to Canada.");
  }

  // CRS bonus factors
  const bonusFlags: string[] = [];
  if (profile.has_provincial_nomination === true)
    bonusFlags.push("has provincial nomination (+600 CRS)");
  else bonusFlags.push("no provincial nomination");
  if (profile.has_canadian_job_offer === true)
    bonusFlags.push("has valid Canadian job offer (+50 CRS)");
  else bonusFlags.push("no Canadian job offer");
  if (profile.has_sibling_in_canada === true)
    bonusFlags.push("has sibling in Canada (+15 CRS)");
  parts.push(`CRS bonus factors: ${bonusFlags.join("; ")}.`);

  // Additional context
  if (profile.intended_province)
    parts.push(`Intended destination province: ${profile.intended_province}.`);
  if (profile.annual_income && profile.income_currency)
    parts.push(
      `Annual income: ${profile.annual_income.toLocaleString()} ${profile.income_currency}.`
    );

  return parts.join(" ");
}

