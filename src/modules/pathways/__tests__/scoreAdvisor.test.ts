import { describe, it, expect } from 'vitest'
import { generateTips } from '../lib/scoreAdvisor'
import type { CRSBreakdown } from '../types'
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
  }
  return { ...stub, ...overrides } as Profile
}

const emptyBreakdown: CRSBreakdown = {
  core: { age: 0, education: 0, first_language: 0, second_language: 0, canadian_work: 0, subtotal: 0 },
  spouse: { education: 0, language: 0, canadian_work: 0, subtotal: 0 },
  skill_transferability: {
    education_language: 0, education_canadian_work: 0,
    foreign_work_language: 0, foreign_work_canadian_work: 0,
    trade_certificate: 0, subtotal: 0,
  },
  additional: { provincial_nomination: 0, french_skills: 0, canadian_education: 0, sibling: 0, subtotal: 0 },
  total: 0,
}

describe('generateTips', () => {
  it('CLB 7 on any ability → language tip is present', () => {
    const profile = makeProfile({
      clb_reading: 7, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
    })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('CLB 9'))).toBe(true)
  })

  it('all CLB >= 9 → no language tip', () => {
    const profile = makeProfile({
      clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
    })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('CLB 9'))).toBe(false)
  })

  it('canadian_work_years null → Canadian work tip present', () => {
    const profile = makeProfile({ canadian_work_years: null })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('Canadian work experience'))).toBe(true)
  })

  it('canadian_work_years 1 → no Canadian work tip', () => {
    const profile = makeProfile({ canadian_work_years: 1 })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('Canadian work experience'))).toBe(false)
  })

  it('all nclc null → French tip present', () => {
    const profile = makeProfile({
      nclc_reading: null, nclc_writing: null, nclc_speaking: null, nclc_listening: null,
    })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('French'))).toBe(true)
  })

  it('all nclc >= 7 → no French tip', () => {
    const profile = makeProfile({
      nclc_reading: 7, nclc_writing: 7, nclc_speaking: 7, nclc_listening: 7,
    })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('French'))).toBe(false)
  })

  it('tips sorted by points_gain_estimate descending', () => {
    const profile = makeProfile({
      clb_reading: 7,
      canadian_work_years: null,
      has_provincial_nomination: false,
    })
    const tips = generateTips(profile, emptyBreakdown)
    for (let i = 1; i < tips.length; i++) {
      expect(tips[i - 1].points_gain_estimate).toBeGreaterThanOrEqual(tips[i].points_gain_estimate)
    }
  })

  it('provincial nomination tip always has highest points_gain_estimate', () => {
    const profile = makeProfile({ has_provincial_nomination: false })
    const tips = generateTips(profile, emptyBreakdown)
    const pnpTip = tips.find(t => t.action.includes('Provincial Nominee'))!
    expect(pnpTip).toBeDefined()
    expect(pnpTip.points_gain_estimate).toBe(600)
    expect(tips[0]).toBe(pnpTip)
  })

  it('has_provincial_nomination true → no PNP tip', () => {
    const profile = makeProfile({ has_provincial_nomination: true })
    const tips = generateTips(profile, emptyBreakdown)
    expect(tips.some(t => t.action.includes('Provincial Nominee'))).toBe(false)
  })
})
