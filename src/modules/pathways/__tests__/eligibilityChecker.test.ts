import { describe, it, expect } from 'vitest'
import { checkEligibility } from '../lib/eligibilityChecker'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

/** Merges partial overrides onto a fully-typed stub Profile. */
function makeProfile(overrides: Partial<Profile> & Record<string, unknown> = {}): Profile {
  const stub: Profile = {
    id: 'test-id',
    auth_user_id: 'test-auth-id',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    onboarding_status: 'complete',
    is_admin: false,
    full_name: null,
    email: null,
    nationality: null,
    current_country: null,
    marital_status: null,
    annual_salary_gbp: null,
    clb_reading: null,
    clb_writing: null,
    clb_speaking: null,
    clb_listening: null,
    nclc_reading: null,
    nclc_writing: null,
    nclc_speaking: null,
    nclc_listening: null,
    second_lang_reading: null,
    second_lang_writing: null,
    second_lang_speaking: null,
    second_lang_listening: null,
    education_level: null,
    degree_level: null,
    degree_field: null,
    has_degree: null,
    eca_obtained: null,
    foreign_work_years: null,
    canadian_work_years: null,
    canadian_education_years: null,
    noc_teer_category: null,
    occupation: null,
    years_experience: null,
    english_level: null,
    has_canadian_job_offer: null,
    has_trade_certificate: null,
    has_provincial_nomination: null,
    has_sibling_in_canada: null,
    has_criminal_record: null,
    has_dependents: null,
    spouse_coming_to_canada: null,
    spouse_education_level: null,
    spouse_clb_reading: null,
    spouse_clb_writing: null,
    spouse_clb_speaking: null,
    spouse_clb_listening: null,
    spouse_canadian_work_years: null,
    profile_completeness_pct: null,
    incomplete_fields: null,
    voice_session_data: null,
    voice_profile_version: null,
  }
  return { ...stub, ...overrides } as Profile
}

/** Base fixture from the spec — strong candidate across all three programs. */
const baseOverrides = {
  age: 28,
  education_level: 'bachelors',
  clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
  foreign_work_years: 2, foreign_work_recent: true,
  canadian_work_years: 0, canadian_work_recent: false,
  noc_teer_category: 1,
  spouse_coming_to_canada: false,
  has_trade_certificate: false,
  has_canadian_job_offer: false,
  has_sibling_in_canada: false,
  has_provincial_nomination: false,
}

// ── FSW ──────────────────────────────────────────────────────────────────────

describe('FSW eligibility', () => {
  it('base profile is FSW eligible', () => {
    const result = checkEligibility(makeProfile(baseOverrides))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.eligible).toBe(true)
  })

  it('foreign_work_recent false → ineligible with recency reason', () => {
    const result = checkEligibility(makeProfile({ ...baseOverrides, foreign_work_recent: false }))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.eligible).toBe(false)
    expect(fsw.reasons.some(r => r.toLowerCase().includes('10 year'))).toBe(true)
  })

  it('clb_reading 6 → ineligible with CLB minimum reason', () => {
    const result = checkEligibility(makeProfile({ ...baseOverrides, clb_reading: 6 }))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.eligible).toBe(false)
    expect(fsw.reasons.some(r => r.includes('CLB 7'))).toBe(true)
  })

  it('foreign_work_years 0 → ineligible', () => {
    const result = checkEligibility(makeProfile({ ...baseOverrides, foreign_work_years: 0 }))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.eligible).toBe(false)
    expect(fsw.reasons.some(r => r.includes('1 year'))).toBe(true)
  })

  it('less_than_secondary education → ineligible', () => {
    const result = checkEligibility(makeProfile({ ...baseOverrides, education_level: 'less_than_secondary' }))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.eligible).toBe(false)
  })

  it('NOC TEER 4 → ineligible', () => {
    const result = checkEligibility(makeProfile({ ...baseOverrides, noc_teer_category: 4 }))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.eligible).toBe(false)
    expect(fsw.reasons.some(r => r.includes('TEER 0, 1, 2, or 3'))).toBe(true)
  })

  it('base profile FSW selection grid score is >= 67', () => {
    const result = checkEligibility(makeProfile(baseOverrides))
    const fsw = result.find(r => r.program === 'fsw')!
    const gridReason = fsw.reasons.find(r => r.includes('selection grid score'))!
    expect(gridReason).toBeDefined()
    const match = gridReason.match(/(\d+)\/100/)
    expect(match).not.toBeNull()
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(67)
  })
})

// ── CEC ──────────────────────────────────────────────────────────────────────

describe('CEC eligibility', () => {
  it('1 year Canadian work TEER 1 CLB 7+ → CEC eligible', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      canadian_work_years: 1,
      canadian_work_recent: true,
      noc_teer_category: 1,
    }))
    const cec = result.find(r => r.program === 'cec')!
    expect(cec.eligible).toBe(true)
  })

  it('canadian_work_years 0 → CEC ineligible', () => {
    const result = checkEligibility(makeProfile({ ...baseOverrides, canadian_work_years: 0 }))
    const cec = result.find(r => r.program === 'cec')!
    expect(cec.eligible).toBe(false)
    expect(cec.reasons.some(r => r.includes('1 year'))).toBe(true)
  })

  it('TEER 3 with CLB 4 → CEC ineligible (needs CLB 5)', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      canadian_work_years: 1,
      canadian_work_recent: true,
      noc_teer_category: 3,
      clb_reading: 4, clb_writing: 4, clb_speaking: 4, clb_listening: 4,
    }))
    const cec = result.find(r => r.program === 'cec')!
    expect(cec.eligible).toBe(false)
    expect(cec.reasons.some(r => r.includes('CLB 5'))).toBe(true)
  })

  it('TEER 3 with CLB 5 → CEC eligible', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      canadian_work_years: 1,
      canadian_work_recent: true,
      noc_teer_category: 3,
      clb_reading: 5, clb_writing: 5, clb_speaking: 5, clb_listening: 5,
    }))
    const cec = result.find(r => r.program === 'cec')!
    expect(cec.eligible).toBe(true)
  })
})

// ── FST ──────────────────────────────────────────────────────────────────────

describe('FST eligibility', () => {
  it('trade cert + 2 years foreign work + CLB 5 speaking/listening + CLB 4 reading/writing → FST eligible', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      foreign_work_years: 2,
      has_trade_certificate: true,
      clb_speaking: 5, clb_listening: 5,
      clb_reading: 4, clb_writing: 4,
    }))
    const fst = result.find(r => r.program === 'fst')!
    expect(fst.eligible).toBe(true)
  })

  it('job offer + 2 years foreign work + CLB 5/4 → FST eligible', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      foreign_work_years: 2,
      has_trade_certificate: false,
      has_canadian_job_offer: true,
      clb_speaking: 5, clb_listening: 5,
      clb_reading: 4, clb_writing: 4,
    }))
    const fst = result.find(r => r.program === 'fst')!
    expect(fst.eligible).toBe(true)
  })

  it('only 1 year foreign work → FST ineligible', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      foreign_work_years: 1,
      has_trade_certificate: true,
      clb_speaking: 5, clb_listening: 5,
      clb_reading: 4, clb_writing: 4,
    }))
    const fst = result.find(r => r.program === 'fst')!
    expect(fst.eligible).toBe(false)
    expect(fst.reasons.some(r => r.includes('2 year'))).toBe(true)
  })

  it('no trade cert and no job offer → FST ineligible', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      foreign_work_years: 2,
      has_trade_certificate: false,
      has_canadian_job_offer: false,
      clb_speaking: 5, clb_listening: 5,
      clb_reading: 4, clb_writing: 4,
    }))
    const fst = result.find(r => r.program === 'fst')!
    expect(fst.eligible).toBe(false)
  })

  it('speaking CLB 4 → FST ineligible with speaking/listening reason', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      foreign_work_years: 2,
      has_trade_certificate: true,
      clb_speaking: 4, clb_listening: 5,
      clb_reading: 4, clb_writing: 4,
    }))
    const fst = result.find(r => r.program === 'fst')!
    expect(fst.eligible).toBe(false)
    expect(fst.reasons.some(r => r.includes('speaking') && r.includes('CLB 5'))).toBe(true)
  })
})

// ── Result shape ─────────────────────────────────────────────────────────────

describe('result shape', () => {
  it('always returns exactly three results — fsw, cec, fst', () => {
    const result = checkEligibility(makeProfile(baseOverrides))
    expect(result).toHaveLength(3)
    expect(result.map(r => r.program).sort()).toEqual(['cec', 'fst', 'fsw'])
  })

  it('missing_criteria populated when optional fields absent', () => {
    const result = checkEligibility(makeProfile({
      ...baseOverrides,
      foreign_work_recent: undefined,
      canadian_work_recent: undefined,
    }))
    const fsw = result.find(r => r.program === 'fsw')!
    expect(fsw.missing_criteria).toContain('foreign_work_recent')
  })
})
