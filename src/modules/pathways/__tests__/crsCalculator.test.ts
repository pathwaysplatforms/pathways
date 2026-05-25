import { describe, it, expect } from 'vitest'
import { calculateCRS } from '../lib/crsCalculator'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

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

// ── Section A: Core ───────────────────────────────────────────────────────────

describe('core — age', () => {
  it('age 25 without spouse → 110 points', () => {
    const result = calculateCRS(makeProfile({ age: 25, spouse_coming_to_canada: false }))
    expect(result.core.age).toBe(110)
  })

  it('age 25 with spouse → 100 points', () => {
    const result = calculateCRS(makeProfile({ age: 25, spouse_coming_to_canada: true }))
    expect(result.core.age).toBe(100)
  })

  it('age null → 0 points', () => {
    const result = calculateCRS(makeProfile({ age: null }))
    expect(result.core.age).toBe(0)
  })

  it('age > 45 clamped to 45 → 0 points', () => {
    const result = calculateCRS(makeProfile({ age: 60, spouse_coming_to_canada: false }))
    expect(result.core.age).toBe(0)
  })
})

describe('core — education', () => {
  it('PhD without spouse → 150 points', () => {
    const result = calculateCRS(makeProfile({ education_level: 'phd', spouse_coming_to_canada: false }))
    expect(result.core.education).toBe(150)
  })

  it('bachelors without spouse → 120 points', () => {
    const result = calculateCRS(makeProfile({ education_level: 'bachelors', spouse_coming_to_canada: false }))
    expect(result.core.education).toBe(120)
  })

  it('null education → 0 points (less_than_secondary fallback)', () => {
    const result = calculateCRS(makeProfile({ education_level: null }))
    expect(result.core.education).toBe(0)
  })
})

describe('core — first language', () => {
  it('CLB 9 all abilities without spouse → 124 points', () => {
    const result = calculateCRS(makeProfile({
      clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
      spouse_coming_to_canada: false,
    }))
    expect(result.core.first_language).toBe(124)
  })

  it('CLB 10 all abilities without spouse → 136 points', () => {
    const result = calculateCRS(makeProfile({
      clb_reading: 10, clb_writing: 10, clb_speaking: 10, clb_listening: 10,
      spouse_coming_to_canada: false,
    }))
    expect(result.core.first_language).toBe(136)
  })

  it('CLB null all abilities → 0 points', () => {
    const result = calculateCRS(makeProfile({ spouse_coming_to_canada: false }))
    expect(result.core.first_language).toBe(0)
  })
})

describe('core — second language', () => {
  it('null second language → 0 points', () => {
    const result = calculateCRS(makeProfile())
    expect(result.core.second_language).toBe(0)
  })

  it('second language score is capped at 24 without spouse', () => {
    const result = calculateCRS(makeProfile({
      second_lang_reading: 12, second_lang_writing: 12,
      second_lang_speaking: 12, second_lang_listening: 12,
      spouse_coming_to_canada: false,
    }))
    expect(result.core.second_language).toBe(24)
  })

  it('second language score is capped at 22 with spouse', () => {
    const result = calculateCRS(makeProfile({
      second_lang_reading: 12, second_lang_writing: 12,
      second_lang_speaking: 12, second_lang_listening: 12,
      spouse_coming_to_canada: true,
    }))
    expect(result.core.second_language).toBe(22)
  })
})

describe('core — Canadian work', () => {
  it('3 years Canadian work without spouse → 64 points', () => {
    const result = calculateCRS(makeProfile({
      canadian_work_years: 3,
      spouse_coming_to_canada: false,
    }))
    expect(result.core.canadian_work).toBe(64)
  })

  it('0 years Canadian work → 0 points', () => {
    const result = calculateCRS(makeProfile({ canadian_work_years: 0 }))
    expect(result.core.canadian_work).toBe(0)
  })

  it('5+ years Canadian work without spouse → 80 points (cap)', () => {
    const result = calculateCRS(makeProfile({
      canadian_work_years: 10,
      spouse_coming_to_canada: false,
    }))
    expect(result.core.canadian_work).toBe(80)
  })
})

// ── Section B: Spouse ─────────────────────────────────────────────────────────

describe('spouse', () => {
  it('no spouse → all spouse sections are 0', () => {
    const result = calculateCRS(makeProfile({ spouse_coming_to_canada: false }))
    expect(result.spouse.education).toBe(0)
    expect(result.spouse.language).toBe(0)
    expect(result.spouse.canadian_work).toBe(0)
    expect(result.spouse.subtotal).toBe(0)
  })

  it('spouse bachelors education → 8 points', () => {
    const result = calculateCRS(makeProfile({
      spouse_coming_to_canada: true,
      spouse_education_level: 'bachelors',
    }))
    expect(result.spouse.education).toBe(8)
  })

  it('spouse section subtotal capped at 40', () => {
    const result = calculateCRS(makeProfile({
      spouse_coming_to_canada: true,
      spouse_education_level: 'phd',
      spouse_clb_reading: 12, spouse_clb_writing: 12,
      spouse_clb_speaking: 12, spouse_clb_listening: 12,
      spouse_canadian_work_years: 10,
    }))
    expect(result.spouse.subtotal).toBe(40)
  })
})

// ── Section C: Skill transferability ──────────────────────────────────────────

describe('skill transferability', () => {
  it('bachelors + CLB 9 all → education_language === 50', () => {
    const result = calculateCRS(makeProfile({
      education_level: 'bachelors',
      clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
    }))
    expect(result.skill_transferability.education_language).toBe(50)
  })

  it('bachelors + CLB 7 → education_language === 25', () => {
    const result = calculateCRS(makeProfile({
      education_level: 'bachelors',
      clb_reading: 7, clb_writing: 7, clb_speaking: 7, clb_listening: 7,
    }))
    expect(result.skill_transferability.education_language).toBe(25)
  })

  it('skill transferability subtotal never exceeds 100', () => {
    const result = calculateCRS(makeProfile({
      education_level: 'phd',
      clb_reading: 12, clb_writing: 12, clb_speaking: 12, clb_listening: 12,
      foreign_work_years: 5,
      canadian_work_years: 5,
      has_trade_certificate: true,
    }))
    expect(result.skill_transferability.subtotal).toBeLessThanOrEqual(100)
  })

  it('education_language 50 + education_canadian_work 50 → educationGroup capped at 50, not 100', () => {
    const result = calculateCRS(makeProfile({
      education_level: 'bachelors',
      clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
      canadian_work_years: 2,
    }))
    expect(result.skill_transferability.education_language).toBe(50)
    expect(result.skill_transferability.education_canadian_work).toBe(50)
    expect(result.skill_transferability.subtotal).toBeLessThanOrEqual(100)
    expect(result.skill_transferability.subtotal).toBe(50)
  })

  it('no relevant experience → skill transferability subtotal is 0', () => {
    const result = calculateCRS(makeProfile({
      education_level: 'less_than_secondary',
      canadian_work_years: 0,
      foreign_work_years: 0,
      has_trade_certificate: false,
    }))
    expect(result.skill_transferability.subtotal).toBe(0)
  })
})

// ── Section D: Additional ─────────────────────────────────────────────────────

describe('additional', () => {
  it('provincial nomination → 600 points', () => {
    const result = calculateCRS(makeProfile({ has_provincial_nomination: true }))
    expect(result.additional.provincial_nomination).toBe(600)
  })

  it('no provincial nomination → 0 points', () => {
    const result = calculateCRS(makeProfile({ has_provincial_nomination: false }))
    expect(result.additional.provincial_nomination).toBe(0)
  })

  it('sibling in Canada → 15 points', () => {
    const result = calculateCRS(makeProfile({ has_sibling_in_canada: true }))
    expect(result.additional.sibling).toBe(15)
  })

  it('3+ years Canadian education → 30 points', () => {
    const result = calculateCRS(makeProfile({ canadian_education_years: 3 }))
    expect(result.additional.canadian_education).toBe(30)
  })

  it('1–2 years Canadian education → 15 points', () => {
    const result = calculateCRS(makeProfile({ canadian_education_years: 1 }))
    expect(result.additional.canadian_education).toBe(15)
  })

  it('NCLC 7+ all abilities + CLB 5+ → 50 French bonus points', () => {
    const result = calculateCRS(makeProfile({
      nclc_reading: 7, nclc_writing: 7, nclc_speaking: 7, nclc_listening: 7,
      clb_reading: 5, clb_writing: 5, clb_speaking: 5, clb_listening: 5,
    }))
    expect(result.additional.french_skills).toBe(50)
  })

  it('NCLC 7+ all abilities but CLB < 5 → 25 French bonus points', () => {
    const result = calculateCRS(makeProfile({
      nclc_reading: 7, nclc_writing: 7, nclc_speaking: 7, nclc_listening: 7,
      clb_reading: 4, clb_writing: 4, clb_speaking: 4, clb_listening: 4,
    }))
    expect(result.additional.french_skills).toBe(25)
  })

  it('NCLC null → 0 French bonus points', () => {
    const result = calculateCRS(makeProfile())
    expect(result.additional.french_skills).toBe(0)
  })
})

// ── Total ─────────────────────────────────────────────────────────────────────

describe('total', () => {
  it('total equals sum of all section subtotals', () => {
    const result = calculateCRS(makeProfile({
      age: 28,
      education_level: 'bachelors',
      clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
      canadian_work_years: 1,
      foreign_work_years: 2,
      spouse_coming_to_canada: false,
      has_provincial_nomination: false,
      has_sibling_in_canada: false,
    }))
    const expected =
      result.core.subtotal +
      result.spouse.subtotal +
      result.skill_transferability.subtotal +
      result.additional.subtotal
    expect(result.total).toBe(expected)
  })
})
