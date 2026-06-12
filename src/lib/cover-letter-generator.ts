import Anthropic from '@anthropic-ai/sdk';
import { InternalError } from '@/lib/errors';

export interface CoverLetterInput {
  fullName: string;
  nationality: string;
  occupation: string;
  yearsExperience: number;
  educationLevel: string;
  degreeField: string;
  destinationCountry: string;
  pathwayName: string;
  stepTitle: string;
  nocCode?: string;
  clbSpeaking?: number;
  clbWriting?: number;
  clbReading?: number;
  clbListening?: number;
  hasCanadianJobOffer?: boolean;
  intendedProvince?: string;
}

const SYSTEM_PROMPT = `You are an expert immigration application writer. You write clear, professional, and persuasive cover letters for immigration applications. Your letters are:

- Concise (under 400 words)
- Factual and grounded in the applicant's real profile data
- Formatted as a proper business letter
- Free of hollow filler phrases ("I am passionate about...", "I firmly believe...")
- Honest about gaps — do not fabricate details not provided

Output only the letter body. No explanations, no preamble, no markdown.`;

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new InternalError('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

function buildUserPrompt(input: CoverLetterInput): string {
  const lines: string[] = [
    `Write a cover letter for an immigration application for the following applicant.`,
    ``,
    `APPLICANT PROFILE:`,
    `Name: ${input.fullName}`,
    `Nationality: ${input.nationality}`,
    `Occupation: ${input.occupation}`,
    `Years of experience: ${input.yearsExperience}`,
    `Education level: ${input.educationLevel}`,
    `Field of study: ${input.degreeField}`,
    `Destination country: ${input.destinationCountry}`,
    `Immigration pathway: ${input.pathwayName}`,
    `Application step: ${input.stepTitle}`,
  ];

  if (input.nocCode) lines.push(`NOC code: ${input.nocCode}`);
  if (input.intendedProvince) lines.push(`Intended province: ${input.intendedProvince}`);
  if (input.hasCanadianJobOffer != null) {
    lines.push(`Canadian job offer: ${input.hasCanadianJobOffer ? 'Yes' : 'No'}`);
  }

  const clbScores = [
    input.clbSpeaking != null ? `Speaking: ${input.clbSpeaking}` : null,
    input.clbListening != null ? `Listening: ${input.clbListening}` : null,
    input.clbReading != null ? `Reading: ${input.clbReading}` : null,
    input.clbWriting != null ? `Writing: ${input.clbWriting}` : null,
  ].filter(Boolean);

  if (clbScores.length > 0) {
    lines.push(`Language scores (CLB): ${clbScores.join(', ')}`);
  }

  lines.push(
    ``,
    `INSTRUCTIONS:`,
    `- Write a formal business letter addressed to the immigration officer or visa processing centre`,
    `- Reference only the facts provided above — do not invent job titles, company names, or scores`,
    `- For any detail not provided, use [PLACEHOLDER] so the applicant can fill it in`,
    `- Keep the letter under 400 words`,
    `- End with a professional closing`
  );

  return lines.join('\n');
}

/** Generates a cover letter draft using Claude Haiku based on the applicant's profile data. */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  });

  const block = message.content[0];
  if (block.type !== 'text') {
    throw new InternalError('Cover letter generator returned non-text content');
  }

  return block.text;
}
