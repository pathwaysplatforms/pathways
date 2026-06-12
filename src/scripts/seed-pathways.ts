/**
 * Seed script: populate pathway_documents with curated chunks and OpenAI embeddings.
 * Run with: npx tsx src/scripts/seed-pathways.ts
 *
 * Requires: OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY in env.
 * Reads .env.local automatically via dotenv.
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PathwayChunk {
  pathway_id: string;
  pathway_name: string;
  country_code: string;
  pathway_type: "permanent_residency" | "work_permit" | "study" | "citizenship" | "family";
  chunk_index: number;
  chunk_text: string;
  source_url: string;
  metadata: Record<string, unknown>;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const PATHWAY_CHUNKS: PathwayChunk[] = [
  // ── Canada: Express Entry FSW ──────────────────────────────────────────────
  {
    pathway_id: "canada-express-entry-fsw",
    pathway_name: "Express Entry – Federal Skilled Worker",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 0,
    chunk_text:
      "The Express Entry Federal Skilled Worker (FSW) program is Canada's flagship federal points-based permanent residency stream for skilled foreign nationals. Managed through an online pool, Immigration, Refugees and Citizenship Canada (IRCC) issues Invitations to Apply (ITAs) in periodic draws to the highest-scoring candidates. FSW targets workers with foreign work experience in skilled occupations (NOC TEER 0, 1, 2, or 3). It is ideal for internationally trained professionals who meet the minimum language thresholds and have at least one year of continuous skilled work experience. Successful applicants obtain Canadian Permanent Residency (PR), which grants the right to live and work anywhere in Canada.",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html",
    metadata: { program: "FSW", stream: "federal" },
  },
  {
    pathway_id: "canada-express-entry-fsw",
    pathway_name: "Express Entry – Federal Skilled Worker",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 1,
    chunk_text:
      "Federal Skilled Worker eligibility requirements: (1) At least one year (1,560 hours total / 30 hours/week) of continuous, paid, full-time skilled work experience in a single NOC TEER 0, 1, 2, or 3 occupation within the last 10 years. Part-time equivalent accepted. (2) Language proficiency: minimum Canadian Language Benchmark (CLB) 7 on ALL four abilities (listening, reading, writing, speaking) in English or French. For IELTS General Training, CLB 7 corresponds to: Listening 6.0, Reading 6.0, Writing 6.0, Speaking 6.0. (3) Education: a Canadian secondary or post-secondary credential, or a foreign credential with an Educational Credential Assessment (ECA) from a designated organization such as WES. (4) Admissibility: no serious criminal record, medical clearance. (5) Sufficient funds to settle in Canada (unless exempt through a valid Canadian job offer).",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers.html",
    metadata: { program: "FSW", stream: "federal" },
  },
  {
    pathway_id: "canada-express-entry-fsw",
    pathway_name: "Express Entry – Federal Skilled Worker",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 2,
    chunk_text:
      "Comprehensive Ranking System (CRS) scoring for Express Entry: Core human capital factors (maximum 460 pts without a spouse): Age (max 110 pts, peaks 20–29), Education (max 150 pts: PhD=150, Masters=135, Bachelors=120), Official Language proficiency (max 128 pts: CLB 10+ all bands), Canadian work experience (max 70 pts for 3+ years). With a spouse, maximum 460 pts. Skill transferability (max 100 pts): strong language + post-secondary; foreign work + education. Additional points: Provincial Nomination +600 pts (near-guarantee of ITA), valid job offer +50–200 pts, sibling in Canada +15 pts. Recent CRS cutoff scores have ranged from 470–560 for all-program draws, but targeted program draws (e.g., healthcare, trades) can invite scores as low as 350–400.",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html",
    metadata: { program: "FSW", stream: "federal" },
  },
  {
    pathway_id: "canada-express-entry-fsw",
    pathway_name: "Express Entry – Federal Skilled Worker",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 3,
    chunk_text:
      "Express Entry FSW process, timeline, and tips: After creating an Express Entry profile, candidates enter the pool and are ranked by CRS score. IRCC draws from the pool weekly or bi-weekly. Once an ITA is received, applicants have 60 days to submit a complete application including police certificates, medicals, identity documents, and language test results. Processing time after complete application submission: approximately 6 months (80% of cases). Government fees: CAD $1,365 for principal applicant (includes right of permanent residence fee), CAD $460 for each accompanying adult family member. Common refusal reasons: misrepresentation, incomplete documents, inadmissibility. Tips to improve CRS: improve language scores (CLB 9+ in all bands adds ~34 points per band vs CLB 7), pursue a provincial nomination, secure a valid job offer, gain Canadian work experience (first year adds 40 CRS points).",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence.html",
    metadata: { program: "FSW", stream: "federal" },
  },

  // ── Canada: OINP ──────────────────────────────────────────────────────────
  {
    pathway_id: "canada-pnp-ontario-oinp",
    pathway_name: "Ontario Immigrant Nominee Program (OINP)",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 0,
    chunk_text:
      "The Ontario Immigrant Nominee Program (OINP) allows the province of Ontario to nominate foreign workers, international students, and Express Entry candidates for permanent residence based on Ontario's specific economic and labour market needs. OINP offers multiple streams. For Express Entry candidates, a provincial nomination through OINP adds 600 CRS points, effectively guaranteeing an ITA in the next federal draw. Ontario is Canada's most populous province and a major destination for skilled immigrants in technology, finance, healthcare, and skilled trades.",
    source_url: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    metadata: { program: "OINP", stream: "provincial" },
  },
  {
    pathway_id: "canada-pnp-ontario-oinp",
    pathway_name: "Ontario Immigrant Nominee Program (OINP)",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 1,
    chunk_text:
      "OINP stream eligibility: (1) Human Capital Priorities Stream (EE-linked): requires an active Express Entry profile in the FSW, CEC, or FSTC class; CLB 7+ in English/French; post-secondary education; NOC TEER 0–3 occupation. Ontario proactively searches the Express Entry pool and issues Notifications of Interest (NOIs). (2) Employer Job Offer – International Student Stream: for recent graduates from eligible Canadian institutions with job offers. (3) Employer Job Offer – Foreign Worker Stream: requires a permanent, full-time job offer from an Ontario employer in a TEER 0–3 occupation, min salary at or above the median for that NOC. (4) French-Speaking Skilled Worker Stream: CLB 7 in French (all 4 bands) plus CLB 6 in English; NOC TEER 0–3; one year work experience; intent to live in Ontario.",
    source_url: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    metadata: { program: "OINP", stream: "provincial" },
  },
  {
    pathway_id: "canada-pnp-ontario-oinp",
    pathway_name: "Ontario Immigrant Nominee Program (OINP)",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 2,
    chunk_text:
      "OINP process and timeline: For EE-linked streams, OINP proactively scans the Express Entry pool. If Ontario issues an NOI, candidates have 45 days to apply to OINP. OINP reviews the provincial application (processing time: 60–120 days). Upon nomination, candidates update their Express Entry profile; IRCC then issues an ITA within the next draw. Federal processing after ITA: ~6 months. Total timeline from NOI to PR card: approximately 12–18 months. Non-EE streams (employer job offer): candidates apply directly to OINP, which nominates them; they then apply to IRCC outside Express Entry. Fees: OINP application fee CAD $1,500 (employer-based streams). Key advantage: the 600-point provincial nomination bonus makes CRS score effectively irrelevant for EE-linked nominees.",
    source_url: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    metadata: { program: "OINP", stream: "provincial" },
  },
  {
    pathway_id: "canada-pnp-ontario-oinp",
    pathway_name: "Ontario Immigrant Nominee Program (OINP)",
    country_code: "CA",
    pathway_type: "permanent_residency",
    chunk_index: 3,
    chunk_text:
      "OINP tips and recent changes: As of 2024, OINP's Human Capital Priorities stream is invitation-only — candidates cannot apply directly. Ontario targets specific occupations in tech (NOC 21xxx), healthcare (NOC 31xxx–32xxx), and skilled trades. Improving your CRS score increases the likelihood of receiving an OINP NOI since Ontario selects from higher CRS bands. Having a job offer in Ontario significantly improves chances of an employer-stream nomination. Common pitfalls: not meeting the CLB 7 requirement (this is a hard cutoff), working experience not in a TEER 0–3 NOC, submitting an OINP application after the 45-day deadline. The French-Speaking Skilled Worker stream is less competitive and worth pursuing if you have strong French proficiency.",
    source_url: "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    metadata: { program: "OINP", stream: "provincial" },
  },

  // ── Canada: Family Sponsorship ────────────────────────────────────────────
  {
    pathway_id: "canada-family-sponsorship",
    pathway_name: "Family Sponsorship (Spouse/Partner/Child)",
    country_code: "CA",
    pathway_type: "family",
    chunk_index: 0,
    chunk_text:
      "The Canadian Family Class sponsorship program allows Canadian citizens and permanent residents to sponsor close family members for permanent residence. The primary family class categories are: spouse or common-law partner, conjugal partner, dependent children (under 22, or 22+ if financially dependent due to a physical or mental condition), parents and grandparents (limited annual intake via lottery), and other relatives (only if no other Canadian relatives). For spouses and partners, the program is divided into the Inland Spousal Sponsorship (applicant in Canada) and Outland Spousal Sponsorship (applicant outside Canada).",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship.html",
    metadata: { program: "FamilyClass", stream: "federal" },
  },
  {
    pathway_id: "canada-family-sponsorship",
    pathway_name: "Family Sponsorship (Spouse/Partner/Child)",
    country_code: "CA",
    pathway_type: "family",
    chunk_index: 1,
    chunk_text:
      "Family Sponsorship eligibility requirements: Sponsor requirements: (1) Canadian citizen or permanent resident, 18 years of age or older. (2) Residing in Canada (or intending to return for citizens living abroad). (3) Not currently sponsored themselves (if a PR). (4) Income threshold: meet the Low Income Cut-Off (LICO) plus 30% — for a family of 2 in 2024 approximately CAD $32,000/year (exception: sponsoring a spouse, common-law partner, or dependent child does not require meeting LICO). (5) Not in receipt of social assistance. (6) Sign an undertaking (3 years for spouse/partner, 10 years for dependent child under 22). Sponsored person requirements: genuine relationship, no criminality, medical clearance.",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html",
    metadata: { program: "FamilyClass", stream: "federal" },
  },
  {
    pathway_id: "canada-family-sponsorship",
    pathway_name: "Family Sponsorship (Spouse/Partner/Child)",
    country_code: "CA",
    pathway_type: "family",
    chunk_index: 2,
    chunk_text:
      "Family Sponsorship process and timeline: Outland sponsorship (sponsored person outside Canada): IRCC processes both the sponsorship application and the permanent residence application together. Processing time: approximately 12 months for spouses and partners. Inland sponsorship (sponsored person in Canada): similar processing time of ~12 months; sponsored person may be eligible for an open work permit while waiting. Fees: sponsorship application fee CAD $75; principal applicant fee CAD $490; right of permanent residence fee CAD $515. Documents: proof of relationship (photos, communications, joint accounts), sponsor's proof of citizenship or PR status, birth certificates, police clearances, medical exams.",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html",
    metadata: { program: "FamilyClass", stream: "federal" },
  },
  {
    pathway_id: "canada-family-sponsorship",
    pathway_name: "Family Sponsorship (Spouse/Partner/Child)",
    country_code: "CA",
    pathway_type: "family",
    chunk_index: 3,
    chunk_text:
      "Family Sponsorship tips and common issues: The most critical requirement is demonstrating a genuine relationship — IRCC officers assess the authenticity of the relationship based on documentation and sometimes interviews. Common refusal reasons: insufficient proof of genuine relationship, sponsor failing the financial requirements, inadmissibility of the sponsored person (past criminal convictions, medical issues). For common-law partners: must have cohabited for at least 12 consecutive months. For conjugal partners: must demonstrate why cohabitation was impossible (immigration barriers, persecution). Recent change: as of 2024, sponsors can file an emergency processing request if the sponsored person faces imminent danger.",
    source_url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/family-sponsorship/spouse-partner-children.html",
    metadata: { program: "FamilyClass", stream: "federal" },
  },

  // ── UK: Skilled Worker ────────────────────────────────────────────────────
  {
    pathway_id: "uk-skilled-worker",
    pathway_name: "UK Skilled Worker Visa",
    country_code: "GB",
    pathway_type: "work_permit",
    chunk_index: 0,
    chunk_text:
      "The UK Skilled Worker visa is the primary route for non-UK nationals to live and work in the United Kingdom. It replaced the old Tier 2 (General) visa in 2021. The visa is employer-sponsored: applicants must have a confirmed job offer from a UK employer that holds a valid Sponsor Licence. The role must be at Regulated Qualifications Framework (RQF) Level 3 or above (equivalent to A-Level). The visa grants permission to live and work in the UK for up to 5 years, after which holders can apply for Indefinite Leave to Remain (ILR — equivalent to permanent residency). Spouses and dependants may accompany or join the main applicant.",
    source_url: "https://www.gov.uk/skilled-worker-visa",
    metadata: { program: "SkillWorker", stream: "national" },
  },
  {
    pathway_id: "uk-skilled-worker",
    pathway_name: "UK Skilled Worker Visa",
    country_code: "GB",
    pathway_type: "work_permit",
    chunk_index: 1,
    chunk_text:
      "UK Skilled Worker eligibility requirements (points-based): To be awarded 70 points you need: (A) Mandatory — 50 points: job offer from licensed sponsor at appropriate skill level (RQF3+) + English language requirement (B1 CEFR / IELTS 4.0 in all components, or citizenship of majority-English-speaking country). (B) Salary — 20 points: meet the salary threshold, which is the HIGHER of: £26,200 per year (minimum threshold from April 2024), or the occupation-specific 'going rate'. Shortage occupation list jobs may qualify at 80% of the going rate. Healthcare occupations (NHS-funded) have specific salary scales. Current salary threshold from 2024: £26,200 general minimum; no tradeable points for shortage occupations as of 2024 (shortage occupation list replaced by immigration salary list).",
    source_url: "https://www.gov.uk/skilled-worker-visa/eligibility",
    metadata: { program: "SkillWorker", stream: "national" },
  },
  {
    pathway_id: "uk-skilled-worker",
    pathway_name: "UK Skilled Worker Visa",
    country_code: "GB",
    pathway_type: "work_permit",
    chunk_index: 2,
    chunk_text:
      "UK Skilled Worker visa process and fees: Application can be made outside the UK (entry clearance) or inside the UK (leave to remain extension). Processing time: 3 weeks standard; 5 business days priority processing. Visa fees: £719 for up to 3 years; £1,420 for over 3 years; plus a £1,035/year Immigration Health Surcharge (IHS) per person. Sponsor pays a Skills Charge: £1,000/year for medium/large businesses; £364/year for charities/small businesses. Documents: Certificate of Sponsorship (CoS) reference number, valid passport, English language proof (exempt if from majority-English-speaking country or have UK degree), tuberculosis test results (selected countries), proof of meeting salary threshold.",
    source_url: "https://www.gov.uk/skilled-worker-visa/apply",
    metadata: { program: "SkillWorker", stream: "national" },
  },
  {
    pathway_id: "uk-skilled-worker",
    pathway_name: "UK Skilled Worker Visa",
    country_code: "GB",
    pathway_type: "work_permit",
    chunk_index: 3,
    chunk_text:
      "UK Skilled Worker pathway to ILR and tips: After 5 years continuous lawful residence on a Skilled Worker visa, you can apply for Indefinite Leave to Remain (permanent settlement). Requirements for ILR: continuous 5-year residence, no absences longer than 180 days in any 12-month period (with some exceptions), meeting salary threshold at time of ILR application, passing the Life in the UK test, demonstrating English proficiency. After ILR, you may apply for British citizenship after 1 further year. Tips: Check whether your occupation appears on the Home Office Shortage Occupation List (now Immigration Salary List), as this may affect salary thresholds. Ensure your employer holds an active Sponsor Licence before applying. The 2024 salary threshold increase from £26,200 to a higher level may affect renewals.",
    source_url: "https://www.gov.uk/indefinite-leave-to-remain/skilled-worker-visa",
    metadata: { program: "SkillWorker", stream: "national" },
  },

  // ── Germany: EU Blue Card ─────────────────────────────────────────────────
  {
    pathway_id: "germany-eu-blue-card",
    pathway_name: "Germany EU Blue Card",
    country_code: "DE",
    pathway_type: "work_permit",
    chunk_index: 0,
    chunk_text:
      "The EU Blue Card (Blaue Karte EU) is Germany's primary visa route for highly qualified non-EU nationals. It is designed for university-educated professionals with a job offer meeting the salary threshold. Holders enjoy preferential treatment compared to regular work visas: faster path to permanent residence, easier family reunification, and the right to move within the EU (with conditions). Germany is Europe's largest economy, offering excellent quality of life, strong social benefits, and a high demand for IT, engineering, and healthcare professionals. The Blue Card is issued for the duration of the employment contract plus three months, up to a maximum of four years.",
    source_url: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
    metadata: { program: "BlueCard", stream: "eu" },
  },
  {
    pathway_id: "germany-eu-blue-card",
    pathway_name: "Germany EU Blue Card",
    country_code: "DE",
    pathway_type: "work_permit",
    chunk_index: 1,
    chunk_text:
      "EU Blue Card Germany eligibility: (1) Recognized university degree (at least 3 years of study at a state-recognized institution). Foreign degrees must be equivalent to a German degree — check recognition via anabin database or apply for a formal recognition assessment (takes 1–3 months). (2) Job offer or employment contract from a German employer in an occupation appropriate to your qualification. (3) Salary threshold (2024 figures): General occupations: minimum annual gross salary of EUR 45,300. Shortage occupations (IT, engineering, mathematics, natural sciences, human medicine, veterinary medicine): minimum EUR 35,300 per year. (4) No German language requirement for the Blue Card itself (though B1 German helps obtain permanent residence faster).",
    source_url: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
    metadata: { program: "BlueCard", stream: "eu" },
  },
  {
    pathway_id: "germany-eu-blue-card",
    pathway_name: "Germany EU Blue Card",
    country_code: "DE",
    pathway_type: "work_permit",
    chunk_index: 2,
    chunk_text:
      "EU Blue Card Germany process and fees: Apply at the German embassy or consulate in your home country, or at the Ausländerbehörde (immigration office) if already in Germany. Processing time: 4–8 weeks in most cases. Required documents: valid passport, biometric photos, proof of degree recognition, job offer/employment contract with salary, health insurance proof, rental agreement or proof of accommodation. Fees: visa application fee approximately EUR 75; residence permit fee EUR 100–145 at the local immigration office. After obtaining the Blue Card, register at the Einwohnermeldeamt (residents' registration office) within 2 weeks of arrival.",
    source_url: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
    metadata: { program: "BlueCard", stream: "eu" },
  },
  {
    pathway_id: "germany-eu-blue-card",
    pathway_name: "Germany EU Blue Card",
    country_code: "DE",
    pathway_type: "work_permit",
    chunk_index: 3,
    chunk_text:
      "EU Blue Card Germany path to permanent residence and tips: EU Blue Card holders can apply for a Niederlassungserlaubnis (permanent settlement permit) after 33 months of employment in a Blue Card role. This reduces to 21 months if you have B1 German language proficiency. Requirements for permanent residence: employment continuity, meeting pension contribution requirements, accommodation, and basic German language. After 5 years of legal residence, German citizenship may be possible (3 years with integration achievements). Tips: German language learning significantly accelerates the PR timeline. IT professionals are in very high demand and frequently qualify under the shortage occupation lower salary threshold. The recognition process for foreign degrees can take time — start this before applying for your visa.",
    source_url: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
    metadata: { program: "BlueCard", stream: "eu" },
  },

  // ── Australia: Skilled Independent 189 ───────────────────────────────────
  {
    pathway_id: "australia-skilled-independent-189",
    pathway_name: "Australia Skilled Independent (subclass 189)",
    country_code: "AU",
    pathway_type: "permanent_residency",
    chunk_index: 0,
    chunk_text:
      "The Australian Skilled Independent visa (subclass 189) is a permanent residence visa for skilled workers who are not sponsored by an employer, state, or territory government. It is points-tested: candidates must submit an Expression of Interest (EOI) through SkillSelect, receive an invitation from the Department of Home Affairs, and then lodge a visa application. The 189 visa allows indefinite residence, unrestricted work rights in Australia, eventual eligibility for Australian citizenship, and travel rights. It is one of Australia's most sought-after visas for professionals who score well on the points test.",
    source_url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
    metadata: { program: "189", stream: "federal" },
  },
  {
    pathway_id: "australia-skilled-independent-189",
    pathway_name: "Australia Skilled Independent (subclass 189)",
    country_code: "AU",
    pathway_type: "permanent_residency",
    chunk_index: 1,
    chunk_text:
      "Subclass 189 eligibility and points test: (1) Occupation on the relevant skilled occupation list (Medium and Long-term Strategic Skills List or Short-term Skilled Occupation List). (2) Positive skills assessment from the relevant assessing authority for your occupation. (3) Under 45 years of age at time of invitation. (4) Competent English (IELTS average band 6.0, or equivalent). (5) Points test score of at least 65 points to submit an EOI. Points breakdown: Age: 25 pts (25–32 years), 30 pts (25–32 via partner assessment). Education: PhD = 20 pts, Bachelor's or higher = 15 pts. Skilled employment overseas (last 10 years): 1–3 yrs = 5 pts, 3–5 yrs = 10 pts, 5–8 yrs = 15 pts, 8+ yrs = 20 pts. English: Competent = 0 pts, Proficient = 10 pts (IELTS 7.0), Superior = 20 pts (IELTS 8.0). Australian skilled employment: 1–3 yrs = 5 pts, 3–5 yrs = 10 pts, 5–8 yrs = 15 pts, 8+ yrs = 20 pts. Specialist education qualification: 5 pts. Australian study requirement (2 years in Australia): 5 pts. Partner skills: 5–10 pts.",
    source_url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
    metadata: { program: "189", stream: "federal" },
  },
  {
    pathway_id: "australia-skilled-independent-189",
    pathway_name: "Australia Skilled Independent (subclass 189)",
    country_code: "AU",
    pathway_type: "permanent_residency",
    chunk_index: 2,
    chunk_text:
      "Subclass 189 process and fees: Submit an EOI through SkillSelect with your points score. Wait for an invitation from the Department of Home Affairs (cutoff scores vary by occupation; often 85–95+ points in highly competitive occupations). Once invited, lodge your visa application within 60 days. Required documents: skills assessment, identity documents, English test results, health examination, police clearances, employment reference letters. Processing time: 9–12 months for 75% of applications. Visa fees: AUD $4,115 for the primary applicant; AUD $2,060 for each additional adult applicant; AUD $1,030 for each child applicant. Biometric collection required at a visa application centre.",
    source_url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
    metadata: { program: "189", stream: "federal" },
  },
  {
    pathway_id: "australia-skilled-independent-189",
    pathway_name: "Australia Skilled Independent (subclass 189)",
    country_code: "AU",
    pathway_type: "permanent_residency",
    chunk_index: 3,
    chunk_text:
      "Subclass 189 tips and recent changes: The subclass 189 is highly competitive; invitation cutoff scores have been rising. A points score of 85+ is recommended to have a realistic chance of invitation in most occupations. Strategies to improve score: improve English to Proficient (IELTS 7.0) or Superior (IELTS 8.0) for +10–20 pts; accumulate more years of skilled employment; pursue an Australian study award for +5 pts; have a skilled partner assessed for +5–10 pts. Common alternatives if 189 score is too low: subclass 190 (state-sponsored, requires a state nomination and adds 5 points) or subclass 491 (regional-sponsored, adds 15 points). Recent change: as of 2023–24, priority processing applies to certain occupations including healthcare, engineering, and education.",
    source_url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189",
    metadata: { program: "189", stream: "federal" },
  },

  // ── Portugal: D7 Passive Income ───────────────────────────────────────────
  {
    pathway_id: "portugal-d7-passive-income",
    pathway_name: "Portugal D7 Passive Income Visa",
    country_code: "PT",
    pathway_type: "permanent_residency",
    chunk_index: 0,
    chunk_text:
      "The Portugal D7 visa (Passive Income Visa / Retirement Visa) is designed for non-EU nationals who have sufficient passive income to support themselves in Portugal without working locally. Income sources can include: pension income, rental income from properties, dividends and investment returns, royalties, or remote work / freelance income from foreign clients. The D7 grants a temporary residence permit (initially 1–2 years, renewable) with the right to live in Portugal and travel freely within the Schengen Area. It is a popular route for retirees, remote workers, and digital nomads from outside the EU.",
    source_url: "https://vistos.mne.gov.pt/en/national-visas/specific-purposes/retired-or-passive-income",
    metadata: { program: "D7", stream: "national" },
  },
  {
    pathway_id: "portugal-d7-passive-income",
    pathway_name: "Portugal D7 Passive Income Visa",
    country_code: "PT",
    pathway_type: "permanent_residency",
    chunk_index: 1,
    chunk_text:
      "Portugal D7 visa eligibility requirements: (1) Minimum regular passive or remote income: at least EUR 820/month for the applicant (equivalent to 1x the Portuguese minimum wage in 2024). An additional 50% for an accompanying spouse and 30% for each dependent child. (2) Proof of accommodation in Portugal: rental agreement, property ownership documents, or hotel booking for initial period. (3) Valid criminal record certificate from your country of residence (issued within 3 months). (4) Valid health insurance covering Portugal. (5) Proof of sufficient funds: typically 12 months of income shown through bank statements. No age restriction; no language requirement for the visa (though Portuguese helps for integration). No job offer required.",
    source_url: "https://vistos.mne.gov.pt/en/national-visas/specific-purposes/retired-or-passive-income",
    metadata: { program: "D7", stream: "national" },
  },
  {
    pathway_id: "portugal-d7-passive-income",
    pathway_name: "Portugal D7 Passive Income Visa",
    country_code: "PT",
    pathway_type: "permanent_residency",
    chunk_index: 2,
    chunk_text:
      "Portugal D7 visa process and fees: Apply at the Portuguese consulate or embassy in your home country. Processing time: 60–90 days at the consulate. Once the D7 visa is issued, travel to Portugal and schedule an appointment at AIMA (formerly SEF — Agency for Integration, Migration and Asylum) to convert the visa to a residence permit. Initial residence permit: 2 years. Renewable for 3 years, then indefinitely. Fees: consulate visa fee approximately EUR 90; AIMA residence permit fee approximately EUR 83. Documents: filled application form, photos, passport, criminal record, health insurance, proof of accommodation, proof of income (bank statements, pension letters, rental contracts).",
    source_url: "https://vistos.mne.gov.pt/en/national-visas/specific-purposes/retired-or-passive-income",
    metadata: { program: "D7", stream: "national" },
  },
  {
    pathway_id: "portugal-d7-passive-income",
    pathway_name: "Portugal D7 Passive Income Visa",
    country_code: "PT",
    pathway_type: "permanent_residency",
    chunk_index: 3,
    chunk_text:
      "Portugal D7 path to PR and citizenship tips: After 5 years of legal residence in Portugal, D7 holders can apply for permanent residence (Autorização de Residência Permanente). After 5 years of legal residence, they may also apply for Portuguese citizenship, provided they demonstrate basic Portuguese language (A2 level) and ties to Portugal. Portugal is an EU member state, so Portuguese citizenship grants EU citizenship and the right to live and work in all 27 EU member states. Tips: open a Portuguese bank account before applying; join the NHR (Non-Habitual Resident) tax regime for favourable tax treatment for the first 10 years. Note: the NHR regime has been replaced by the IFICI regime from 2024 — check current tax benefits. AIMA appointment wait times can be long — book as early as possible after arriving.",
    source_url: "https://vistos.mne.gov.pt/en/national-visas/specific-purposes/retired-or-passive-income",
    metadata: { program: "D7", stream: "national" },
  },

  // ── USA: H-1B ────────────────────────────────────────────────────────────
  {
    pathway_id: "usa-h1b-specialty-occupation",
    pathway_name: "USA H-1B Specialty Occupation",
    country_code: "US",
    pathway_type: "work_permit",
    chunk_index: 0,
    chunk_text:
      "The H-1B is the United States' primary non-immigrant work visa for specialty occupation workers. A specialty occupation requires theoretical and practical application of highly specialized knowledge and at minimum a bachelor's degree or equivalent in the specific specialty (or its equivalent). H-1B is employer-sponsored: a US employer must file a petition on your behalf and pay applicable fees. Due to the annual numerical cap (65,000 + 20,000 master's degree exemption), H-1B petitions are selected via a random lottery each spring for the following fiscal year (starting October 1). The maximum H-1B stay is 6 years (initial 3-year period, one 3-year extension), extendable further if a green card process is underway.",
    source_url: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    metadata: { program: "H1B", stream: "federal" },
  },
  {
    pathway_id: "usa-h1b-specialty-occupation",
    pathway_name: "USA H-1B Specialty Occupation",
    country_code: "US",
    pathway_type: "work_permit",
    chunk_index: 1,
    chunk_text:
      "H-1B eligibility requirements: (1) Job offer from a US employer for a specialty occupation position. Specialty occupations include: engineering, IT/computer science, architecture, accounting, law, medicine, and many others requiring a related bachelor's degree. (2) Applicant must hold at minimum a US bachelor's degree or foreign equivalent in the specialty field. A three-year degree from India (e.g., B.Sc.) may or may not qualify as equivalent — a credentials evaluation by NACES member is recommended. (3) The employer must file a Labor Condition Application (LCA) with the Department of Labor attesting to wage compliance (must pay prevailing wage or actual wage, whichever is higher). (4) No English or language test requirement for H-1B.",
    source_url: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    metadata: { program: "H1B", stream: "federal" },
  },
  {
    pathway_id: "usa-h1b-specialty-occupation",
    pathway_name: "USA H-1B Specialty Occupation",
    country_code: "US",
    pathway_type: "work_permit",
    chunk_index: 2,
    chunk_text:
      "H-1B process and lottery: Registration window: employer registers electronically each March (USD $215 registration fee from 2024). Lottery selection: USCIS runs a random lottery in late March/April. Master's holders (US degrees) are entered in a 20,000 cap-exempt sub-lottery first, then the general lottery. Petition filing: selected employers have April–June to file petitions with USCIS. Visa stamping: successful petitioners apply for H-1B visa stamp at US embassy/consulate. Start date: October 1 of that year. Processing time: 3–6 months standard; 1–3 months premium processing (USD $2,805 fee). Annual fees: USCIS filing fees USD $460–$780; attorney fees typically USD $2,000–$5,000 (employer usually pays). H-4 visa available for spouse (work authorization not automatic — EAD required separately).",
    source_url: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    metadata: { program: "H1B", stream: "federal" },
  },
  {
    pathway_id: "usa-h1b-specialty-occupation",
    pathway_name: "USA H-1B Specialty Occupation",
    country_code: "US",
    pathway_type: "work_permit",
    chunk_index: 3,
    chunk_text:
      "H-1B tips and path to green card: The H-1B is a non-immigrant status, but it is 'dual intent' — you can have immigration intent while on H-1B. To stay in the US long-term, most H-1B holders pursue an employment-based green card (EB-2 or EB-3). For nationals of India and China, the green card backlog is extremely long (decades in some categories). For other nationalities, the process can take 2–5 years. Tips: maximize your lottery odds by having a US master's degree. Cap-exempt employers (universities, non-profits, government research) do not use the lottery. Some companies transfer H-1B workers from overseas offices under the L-1 intracompany transferee visa instead, bypassing the lottery. O-1 visa is an alternative for individuals with extraordinary ability. Maintaining H-1B status requires staying employed with the sponsoring employer or quickly finding a new sponsor.",
    source_url: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    metadata: { program: "H1B", stream: "federal" },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  if (!openaiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const openai = new OpenAI({ apiKey: openaiKey });

  console.log(`Seeding ${PATHWAY_CHUNKS.length} pathway chunks…`);

  for (const chunk of PATHWAY_CHUNKS) {
    process.stdout.write(
      `  [${chunk.pathway_id}] chunk ${chunk.chunk_index} — embedding…`
    );

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk.chunk_text.replace(/\n/g, " "),
    });
    const embedding = embeddingResponse.data[0].embedding;

    const { error } = await supabase.from("pathway_documents").upsert(
      {
        pathway_id: chunk.pathway_id,
        pathway_name: chunk.pathway_name,
        country_code: chunk.country_code,
        pathway_type: chunk.pathway_type,
        chunk_index: chunk.chunk_index,
        chunk_text: chunk.chunk_text,
        source_url: chunk.source_url,
        embedding: `[${embedding.join(",")}]`,
        metadata: chunk.metadata,
      },
      {
        onConflict: "pathway_id,chunk_index",
        ignoreDuplicates: false,
      }
    );

    if (error) {
      console.error(`\n  ERROR: ${error.message}`);
      throw error;
    }

    console.log(" done");
  }

  console.log(`\nSeeded ${PATHWAY_CHUNKS.length} chunks across ${new Set(PATHWAY_CHUNKS.map((c) => c.pathway_id)).size} pathways.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
