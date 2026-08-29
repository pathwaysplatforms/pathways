import Anthropic from '@anthropic-ai/sdk';
import { InternalError } from '@/lib/errors';
import type { AiActionType } from '@/modules/dashboard/types';

/** Profile fields the AI generators need — subset of profiles table. */
export interface AiProfileContext {
  fullName: string | null;
  nationality: string | null;
  occupation: string | null;
  yearsExperience: number | null;
  educationLevel: string | null;
  degreeField: string | null;
  nocCode: string | null;
  clbSpeaking: number | null;
  clbListening: number | null;
  clbReading: number | null;
  clbWriting: number | null;
  intendedProvince: string | null;
  hasCanadianJobOffer: boolean | null;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new InternalError('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}

async function generate(system: string, user: string): Promise<string> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = message.content[0];
  if (!block || block.type !== 'text') throw new InternalError('AI generator returned non-text content');
  return block.text;
}

const SYSTEM_EMAIL = `You are an expert immigration document writer. You draft professional, concise emails for immigration applicants.
Rules:
- Under 300 words
- Formal business tone — no hollow phrases or filler
- Where information is missing, insert [PLACEHOLDER] so the applicant can fill it in
- Output only the email body (Subject + body). No preamble, no markdown, no closing remarks outside the letter.`;

const SYSTEM_LETTER = `You are an expert immigration document writer. You draft clear, professional letters for Canadian immigration applications.
Rules:
- Under 400 words
- Formal business tone — factual and grounded in the supplied profile
- Where information is missing, insert [PLACEHOLDER]
- Output only the letter body. No explanations, no preamble, no markdown.`;

function name(p: AiProfileContext): string {
  return p.fullName ?? '[Your Full Name]';
}

function clbLine(p: AiProfileContext): string | null {
  const parts = [
    p.clbSpeaking != null ? `Speaking ${p.clbSpeaking}` : null,
    p.clbListening != null ? `Listening ${p.clbListening}` : null,
    p.clbReading != null ? `Reading ${p.clbReading}` : null,
    p.clbWriting != null ? `Writing ${p.clbWriting}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Draft email requesting an employer reference letter. */
async function employerReferenceEmail(p: AiProfileContext, pathwayTitle: string): Promise<string> {
  const clb = clbLine(p);
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to their employer (or former employer) requesting a formal employment reference letter for a Canadian Permanent Residency application under ${pathwayTitle}.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[occupation]'}
Years of experience: ${p.yearsExperience ?? '[years]'}
NOC code: ${p.nocCode ?? '[NOC code]'}
${clb ? `Language scores (CLB): ${clb}` : ''}
${p.hasCanadianJobOffer ? 'Has a Canadian job offer: Yes' : ''}

The letter should request that the employer include: full legal name, job title, employment start and end dates, weekly hours, annual salary, and a description of duties aligned with the NOC lead statement. Mention this is a standard immigration requirement.`);
}

/** Draft inquiry email to ECA body (e.g. WES) initiating an ECA application. */
async function ecaInquiryEmail(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to World Education Services (WES) initiating or inquiring about an Educational Credential Assessment (ECA) application for Canadian immigration purposes.

APPLICANT PROFILE:
Education level: ${p.educationLevel ?? '[degree level]'}
Field of study: ${p.degreeField ?? '[field]'}
Nationality: ${p.nationality ?? '[nationality]'}

The email should ask about the required documents, processing timeline, and how to send official transcripts directly from the applicant's institution. Reference that this ECA is for an Express Entry profile.`);
}

/** Draft follow-up email to WES checking on ECA application status. */
async function ecaStatusEmail(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write a follow-up email from ${name(p)} to World Education Services (WES) requesting an update on the status of their Educational Credential Assessment application.

APPLICANT PROFILE:
Education level: ${p.educationLevel ?? '[degree level]'}
Field of study: ${p.degreeField ?? '[field]'}
Nationality: ${p.nationality ?? '[nationality]'}

The email should politely request a processing status update and ask for the expected completion date. Include [WES_REFERENCE_NUMBER] as a placeholder for the applicant's reference number.`);
}

/** Draft email to a language test centre requesting an official score report. */
async function languageScoreEmail(p: AiProfileContext): Promise<string> {
  const clb = clbLine(p);
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to their IELTS or CELPIP test centre requesting a copy of their official language test score report for Canadian immigration (Express Entry) purposes.

APPLICANT PROFILE:
${clb ? `Reported CLB scores: ${clb}` : 'CLB scores: [not yet received]'}

The email should request the official score report, confirm whether it has been electronically submitted to IRCC, and ask for the TRF number (IELTS) or order number (CELPIP). Include [TEST_CENTRE_NAME], [TEST_DATE], and [CANDIDATE_ID] as placeholders.`);
}

/** Draft email to a bank requesting proof of funds letter. */
async function bankLetterRequestEmail(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to their bank requesting an official proof-of-funds letter for a Canadian immigration application.

The letter should state that the email asks the bank to provide an official letter on bank letterhead confirming:
- Account holder's full legal name
- Account number(s)
- Current available balance
- Currency and, if relevant, CAD equivalent
- Date of the letter

Mention this is required for Canadian Permanent Residency under the Express Entry program. Include [BANK_NAME] and [ACCOUNT_NUMBER] as placeholders.`);
}

/** Draft an immigration cover letter for the applicant's Express Entry profile. */
async function coverLetter(p: AiProfileContext, pathwayTitle: string): Promise<string> {
  const clb = clbLine(p);
  return generate(SYSTEM_LETTER, `Write a formal immigration cover letter for the following applicant applying for Permanent Residency through ${pathwayTitle}.

APPLICANT PROFILE:
Name: ${name(p)}
Nationality: ${p.nationality ?? '[nationality]'}
Occupation: ${p.occupation ?? '[occupation]'}
NOC code: ${p.nocCode ?? '[NOC code]'}
Years of experience: ${p.yearsExperience ?? '[years]'}
Education: ${p.educationLevel ?? '[degree level]'} in ${p.degreeField ?? '[field]'}
${clb ? `Language scores (CLB): ${clb}` : ''}
${p.intendedProvince ? `Intended province: ${p.intendedProvince}` : ''}
${p.hasCanadianJobOffer ? 'Has a valid Canadian job offer: Yes' : ''}

Address the letter to the immigration officer. Reference the pathway, summarise the applicant's qualifications, and explain their intent to settle in Canada. For any missing details insert [PLACEHOLDER].`);
}

/** Draft email from applicant to employer requesting a support/reference letter for a PNP or employer-specific pathway. */
async function employerSupportEmail(p: AiProfileContext, pathwayTitle: string): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to their current employer requesting a support letter for a Canadian immigration application under ${pathwayTitle}.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[occupation]'}
Years of experience: ${p.yearsExperience ?? '[years]'}
NOC code: ${p.nocCode ?? '[NOC code]'}
${p.intendedProvince ? `Intended province: ${p.intendedProvince}` : ''}

The letter should ask the employer to confirm the job offer is genuine, describe the role's duties, and state that the applicant is valued. Request the letter be on official company letterhead and signed by an authorised representative. Include [EMPLOYER_NAME] and [COMPANY_NAME] as placeholders.`);
}

/** Draft inquiry email to a PNP office regarding nomination status or application requirements. */
async function pnpInquiryEmail(p: AiProfileContext, pathwayTitle: string): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write a professional inquiry email from ${name(p)} to a provincial nominee program (PNP) office regarding their application under ${pathwayTitle}.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[occupation]'}
NOC code: ${p.nocCode ?? '[NOC code]'}
${p.intendedProvince ? `Intended province: ${p.intendedProvince}` : ''}

The email should politely ask for: confirmation that the application has been received, current processing times, and whether any additional documents are required. Include [APPLICATION_REFERENCE_NUMBER] and [PROGRAM_NAME] as placeholders.`);
}

/** Draft inquiry email to a provincial trade certification body requesting a certificate of qualification. */
async function tradeCertInquiryEmail(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to a provincial or territorial trades certification body requesting information about obtaining a Certificate of Qualification for Canadian immigration purposes under the Federal Skilled Trades Program.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[trade occupation]'}
NOC code: ${p.nocCode ?? '[NOC code]'}
${p.intendedProvince ? `Intended province: ${p.intendedProvince}` : ''}

The email should ask about: the application process for a Certificate of Qualification, required documents (proof of training, work experience records), processing times, fees, and any reciprocal recognition from foreign credentials. Include [CERTIFYING_BODY_NAME] and [PROVINCE] as placeholders.`);
}

/** Draft email to an educational institution requesting official transcripts for immigration purposes. */
async function transcriptRequestEmail(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to the registrar of their educational institution requesting official transcripts for Canadian immigration purposes.

APPLICANT PROFILE:
Education level: ${p.educationLevel ?? '[degree level]'}
Field of study: ${p.degreeField ?? '[field]'}

The email should specify that the transcripts are needed for an Educational Credential Assessment (ECA) with a designated Canadian organization, ask whether transcripts can be sent directly to the ECA body in sealed envelopes or electronically, enquire about the fees and timeline, and provide the institution's relevant details. Include [INSTITUTION_NAME], [STUDENT_ID], [GRADUATION_YEAR], and [ECA_BODY_ADDRESS] as placeholders.`);
}

/** Draft inquiry email to a Startup Visa designated organization requesting information on their intake process. */
async function designatedOrgInquiryEmail(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write a professional inquiry email from ${name(p)} to a Canadian Startup Visa designated organization (venture capital fund, angel investor group, or business incubator) expressing interest in receiving a Letter of Support for a Startup Visa application.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[role]'}

The email should briefly describe the applicant's business concept, ask about the organization's intake process and criteria for supporting startups, enquire about any pitch deck or documentation requirements, and request a call or meeting to discuss further. Keep it concise — under 250 words. Include [ORGANIZATION_NAME], [BUSINESS_NAME], and [BUSINESS_SECTOR] as placeholders.`);
}

/** Draft follow-up email to a designated organization regarding the status of a Startup Visa commitment letter. */
async function commitmentLetterFollowUp(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write a polite follow-up email from ${name(p)} to a Canadian Startup Visa designated organization checking on the status of their commitment letter (Letter of Support) for a Startup Visa application to IRCC.

The email should: reference the previous meeting or pitch, politely ask about the timeline for a decision, offer to provide any additional information requested, and reiterate the applicant's commitment to establishing their business in Canada. Include [ORGANIZATION_NAME], [BUSINESS_NAME], and [PITCH_DATE] as placeholders.`);
}

/** Draft email to a Rural and Northern Immigration Pilot community requesting a recommendation. */
async function communityRecommendationRequest(p: AiProfileContext, pathwayTitle: string): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write an email from ${name(p)} to a participating Rural and Northern Immigration Pilot (RNIP) community requesting information about their recommendation process and expressing interest in settling there.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[occupation]'}
NOC code: ${p.nocCode ?? '[NOC code]'}
Years of experience: ${p.yearsExperience ?? '[years]'}

The email should: introduce the applicant and their professional background, explain they have a job offer from a local employer, ask about the community's recommendation application process and timeline, and express genuine interest in contributing to the community. Reference the pathway: ${pathwayTitle}. Include [COMMUNITY_NAME], [EMPLOYER_NAME], and [JOB_TITLE] as placeholders.`);
}

/** Draft a personal support letter for a family sponsorship application. */
async function sponsorshipSupportLetter(p: AiProfileContext): Promise<string> {
  return generate(SYSTEM_LETTER, `Write a personal support letter from ${name(p)} (the sponsor) supporting a Canadian family sponsorship application.

SPONSOR PROFILE:
Occupation: ${p.occupation ?? '[occupation]'}
${p.intendedProvince ? `Province: ${p.intendedProvince}` : ''}

The letter should: confirm the sponsor's Canadian citizenship or permanent resident status, describe the genuine family relationship with the sponsored person, explain the sponsor's financial ability and commitment to support the family member, and affirm that the sponsor will honour the undertaking obligations for the specified period. Keep it factual and sincere. Include [SPONSOR_STATUS], [FAMILY_MEMBER_NAME], [RELATIONSHIP], [SPONSORSHIP_DURATION], and [PROVINCE] as placeholders.`);
}

/** Draft inquiry email to an Atlantic province regarding the AIP endorsement process. */
async function endorsementInquiryEmail(p: AiProfileContext, pathwayTitle: string): Promise<string> {
  return generate(SYSTEM_EMAIL, `Write a professional inquiry email from ${name(p)} to an Atlantic Immigration Program (AIP) designated employer or provincial contact regarding the endorsement application process under ${pathwayTitle}.

APPLICANT PROFILE:
Occupation: ${p.occupation ?? '[occupation]'}
NOC code: ${p.nocCode ?? '[NOC code]'}

The email should ask about: the employer's role in submitting the endorsement application to the provincial government, required documentation from the applicant, the expected timeline for provincial endorsement, and next steps after the endorsement certificate is issued. Include [EMPLOYER_NAME], [ATLANTIC_PROVINCE], and [JOB_TITLE] as placeholders.`);
}

/** Dispatch table: call the correct generator for the given action type. */
export async function generateAiDraft(
  actionType: AiActionType,
  profile: AiProfileContext,
  pathwayTitle: string,
): Promise<string> {
  switch (actionType) {
    case 'employer_reference_email':        return employerReferenceEmail(profile, pathwayTitle);
    case 'eca_inquiry_email':               return ecaInquiryEmail(profile);
    case 'eca_status_email':                return ecaStatusEmail(profile);
    case 'language_score_email':            return languageScoreEmail(profile);
    case 'bank_letter_request_email':       return bankLetterRequestEmail(profile);
    case 'cover_letter':                    return coverLetter(profile, pathwayTitle);
    case 'employer_support_email':          return employerSupportEmail(profile, pathwayTitle);
    case 'pnp_inquiry_email':               return pnpInquiryEmail(profile, pathwayTitle);
    case 'trade_cert_inquiry_email':        return tradeCertInquiryEmail(profile);
    case 'transcript_request_email':        return transcriptRequestEmail(profile);
    case 'designated_org_inquiry_email':    return designatedOrgInquiryEmail(profile);
    case 'commitment_letter_follow_up':     return commitmentLetterFollowUp(profile);
    case 'community_recommendation_request':return communityRecommendationRequest(profile, pathwayTitle);
    case 'sponsorship_support_letter':      return sponsorshipSupportLetter(profile);
    case 'endorsement_inquiry_email':       return endorsementInquiryEmail(profile, pathwayTitle);
  }
}
