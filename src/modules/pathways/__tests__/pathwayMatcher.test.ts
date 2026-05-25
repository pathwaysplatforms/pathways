import { describe, it, expect } from 'vitest'
import { matchPathways } from '../lib/pathwayMatcher'
import type { EligibilityResult, CRSBreakdown } from '../types'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'test-id',
    auth_user_id: 'test-auth-id',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    onboarding_status: 'complete',
    is_admin: false,
    full_name: null, email: null, nationality: null, current_country: null,
    marital_status: null, annual_salary_gbp: null,
    clb_reading: null, clb_writing: null, clb_speaking: null, clb_listening: null,
    nclc_reading: null, nclc_writing: null, nclc_speaking: null, nclc_listening: null,
    second_lang_reading: null, second_lang_writing: null,
    second_lang_speaking: null, second_lang_listening: null,
    education_level: null, degree_level: null, degree_field: null,
    has_degree: null, eca_obtained: null,
    foreign_work_years: null, canadian_work_years: null, canadian_education_years: null,
    noc_teer_category: null, occupation: null, years_experience: null, english_level: null,
    has_canadian_job_offer: null, has_trade_certificate: null,
    has_provincial_nomination: null, has_sibling_in_canada: null,
    has_criminal_record: null, has_dependents: null,
    spouse_coming_to_canada: null, spouse_education_level: null,
    spouse_clb_reading: null, spouse_clb_writing: null,
    spouse_clb_speaking: null, spouse_clb_listening: null,
    spouse_canadian_work_years: null,
    profile_completeness_pct: null, incomplete_fields: null,
    voice_session_data: null, voice_profile_version: null,
    ...overrides,
  } as Profile
}

function makeBreakdown(total: number): CRSBreakdown {
  return {
    core: { age: 0, education: 0, first_language: 0, second_language: 0, canadian_work: 0, subtotal: 0 },
    spouse: { education: 0, language: 0, canadian_work: 0, subtotal: 0 },
    skill_transferability: {
      education_language: 0, education_canadian_work: 0,
      foreign_work_language: 0, foreign_work_canadian_work: 0,
      trade_certificate: 0, subtotal: 0,
    },
    additional: { provincial_nomination: 0, french_skills: 0, canadian_education: 0, sibling: 0, subtotal: 0 },
    total,
  }
}

const fswEligible: EligibilityResult = { program: 'fsw', eligible: true, reasons: [], missing_criteria: [] }
const cecEligible: EligibilityResult = { program: 'cec', eligible: true, reasons: [], missing_criteria: [] }
const fstEligible: EligibilityResult = { program: 'fst', eligible: true, reasons: [], missing_criteria: [] }
const fswIneligible: EligibilityResult = { program: 'fsw', eligible: false, reasons: ['reason'], missing_criteria: [] }
const cecIneligible: EligibilityResult = { program: 'cec', eligible: false, reasons: ['reason'], missing_criteria: [] }
const fstIneligible: EligibilityResult = { program: 'fst', eligible: false, reasons: ['reason'], missing_criteria: [] }

describe('matchPathways', () => {
  it('only eligible programs appear in results', () => {
    const eligibility = [fswEligible, cecIneligible, fstIneligible]
    const result = matchPathways(makeProfile(), eligibility, makeBreakdown(480))
    expect(result).toHaveLength(1)
    expect(result[0].program).toBe('fsw')
  })

  it('returns empty array when no programs are eligible', () => {
    const eligibility = [fswIneligible, cecIneligible, fstIneligible]
    const result = matchPathways(makeProfile(), eligibility, makeBreakdown(300))
    expect(result).toHaveLength(0)
  })

  it('CRS 510 with cutoff 470 → competitiveness strong', () => {
    const result = matchPathways(makeProfile(), [fswEligible, cecIneligible, fstIneligible], makeBreakdown(510))
    expect(result[0].competitiveness).toBe('strong')
  })

  it('CRS 460 with cutoff 470 → competitiveness competitive', () => {
    const result = matchPathways(makeProfile(), [fswEligible, cecIneligible, fstIneligible], makeBreakdown(460))
    expect(result[0].competitiveness).toBe('competitive')
  })

  it('CRS 440 with cutoff 470 → competitiveness below_cutoff', () => {
    const result = matchPathways(makeProfile(), [fswEligible, cecIneligible, fstIneligible], makeBreakdown(440))
    expect(result[0].competitiveness).toBe('below_cutoff')
  })

  it('strong results appear before competitive', () => {
    const eligibility = [fswEligible, cecEligible, fstIneligible]
    const result = matchPathways(makeProfile(), eligibility, makeBreakdown(510))
    expect(result.every(r => r.competitiveness === 'strong')).toBe(true)
  })

  it('result contains expected pathway metadata', () => {
    const result = matchPathways(makeProfile(), [fswEligible, cecIneligible, fstIneligible], makeBreakdown(490))
    expect(result[0].pathway_id).toBe('ca_express_entry_fsw')
    expect(result[0].name).toContain('Federal Skilled Worker')
    expect(result[0].next_steps.length).toBeGreaterThan(0)
    expect(result[0].recent_cutoff).toBe(470)
  })

  it('all three eligible programs all appear in results', () => {
    const eligibility = [fswEligible, cecEligible, fstEligible]
    const result = matchPathways(makeProfile(), eligibility, makeBreakdown(480))
    expect(result).toHaveLength(3)
    const programs = result.map(r => r.program)
    expect(programs).toContain('fsw')
    expect(programs).toContain('cec')
    expect(programs).toContain('fst')
  })
})
