import type { Database } from '@/types/database'
import type { CRSBreakdown } from '../types'
import {
  AGE_POINTS,
  EDUCATION_POINTS,
  FIRST_LANG_POINTS_PER_ABILITY,
  SECOND_LANG_POINTS_PER_ABILITY,
  SECOND_LANG_CAP,
  CANADIAN_WORK_POINTS,
  SPOUSE_EDUCATION_POINTS,
  SPOUSE_LANG_POINTS_PER_ABILITY,
  SPOUSE_WORK_POINTS,
} from '../constants/crsPointTables'
import type { CLBScore, WorkBucket } from '../constants/crsPointTables'

type Profile = Database['public']['Tables']['profiles']['Row']

/** Fields in the spec but not yet in the DB schema. */
type ProfileExtensions = {
  age?: number | null
}

type ExtendedProfile = Profile & ProfileExtensions

type AgeKey = keyof typeof AGE_POINTS.withSpouse
type EducationKey = keyof typeof EDUCATION_POINTS.withSpouse

function workBucket(years: number | null): WorkBucket {
  if (!years || years <= 0) return 0
  if (years >= 5) return 5
  return years as 1 | 2 | 3 | 4
}

function clampCLB(clb: number | null): CLBScore {
  return Math.min(Math.max(clb ?? 0, 0), 12) as CLBScore
}

/** Calculates the full CRS breakdown for an Express Entry profile. */
export function calculateCRS(profile: Profile): CRSBreakdown {
  const p = profile as ExtendedProfile
  const hasSpouse = p.spouse_coming_to_canada === true
  const key = hasSpouse ? 'withSpouse' : 'withoutSpouse'

  const eduLevel: EducationKey = (p.education_level ?? 'less_than_secondary') as EducationKey

  // ── Section A: Core ────────────────────────────────────────────────────────

  const rawAge = p.age ?? null
  const ageClamped = rawAge !== null ? (Math.min(Math.max(rawAge, 17), 45) as AgeKey) : null
  const age = ageClamped !== null ? (AGE_POINTS[key][ageClamped] ?? 0) : 0

  const education = EDUCATION_POINTS[key][eduLevel] ?? 0

  const firstLangAbilities = [p.clb_reading, p.clb_writing, p.clb_speaking, p.clb_listening]
  const first_language = firstLangAbilities.reduce<number>(
    (sum, clb) => sum + FIRST_LANG_POINTS_PER_ABILITY[key][clampCLB(clb)],
    0,
  )

  const secondLangAbilities = [
    p.second_lang_reading, p.second_lang_writing,
    p.second_lang_speaking, p.second_lang_listening,
  ]
  const rawSecond = secondLangAbilities.reduce<number>(
    (sum, clb) => sum + SECOND_LANG_POINTS_PER_ABILITY[key][clampCLB(clb)],
    0,
  )
  const second_language = Math.min(rawSecond, SECOND_LANG_CAP[key])

  const canadian_work = CANADIAN_WORK_POINTS[key][workBucket(p.canadian_work_years)]

  const coreSubtotal = age + education + first_language + second_language + canadian_work

  // ── Section B: Spouse ─────────────────────────────────────────────────────

  let spouseEducation = 0
  let spouseLanguage = 0
  let spouseCanadianWork = 0

  if (hasSpouse) {
    const spouseEduKey = (p.spouse_education_level ?? 'less_than_secondary') as keyof typeof SPOUSE_EDUCATION_POINTS
    spouseEducation = SPOUSE_EDUCATION_POINTS[spouseEduKey] ?? 0

    const spouseLangAbilities = [
      p.spouse_clb_reading, p.spouse_clb_writing,
      p.spouse_clb_speaking, p.spouse_clb_listening,
    ]
    const rawSpouseLang = spouseLangAbilities.reduce<number>(
      (sum, clb) => sum + SPOUSE_LANG_POINTS_PER_ABILITY[clampCLB(clb)],
      0,
    )
    spouseLanguage = Math.min(rawSpouseLang, 20)

    spouseCanadianWork = SPOUSE_WORK_POINTS[workBucket(p.spouse_canadian_work_years)]
  }

  const spouseSubtotal = Math.min(spouseEducation + spouseLanguage + spouseCanadianWork, 40)

  // ── Section C: Skill transferability ──────────────────────────────────────

  const minCLB = Math.min(
    p.clb_reading ?? 0, p.clb_writing ?? 0,
    p.clb_speaking ?? 0, p.clb_listening ?? 0,
  )
  const fw = p.foreign_work_years ?? 0
  const cw = p.canadian_work_years ?? 0

  const highEd = (['bachelors', 'two_or_more_credentials', 'masters', 'phd'] as string[]).includes(eduLevel)
  const midEd = (['one_year_post_secondary', 'two_year_post_secondary'] as string[]).includes(eduLevel)

  let education_language = 0
  if (highEd) {
    if (minCLB >= 9) education_language = 50
    else if (minCLB >= 7) education_language = 25
  } else if (midEd) {
    if (minCLB >= 9) education_language = 25
    else if (minCLB >= 7) education_language = 13
  }

  let education_canadian_work = 0
  if (highEd) {
    if (cw >= 2) education_canadian_work = 50
    else if (cw >= 1) education_canadian_work = 25
  } else if (midEd) {
    if (cw >= 2) education_canadian_work = 25
    else if (cw >= 1) education_canadian_work = 13
  }

  let foreign_work_language = 0
  if (fw >= 3) {
    if (minCLB >= 9) foreign_work_language = 50
    else if (minCLB >= 7) foreign_work_language = 25
  } else if (fw >= 1) {
    if (minCLB >= 9) foreign_work_language = 25
    else if (minCLB >= 7) foreign_work_language = 13
  }

  let foreign_work_canadian_work = 0
  if (fw >= 3) {
    if (cw >= 2) foreign_work_canadian_work = 50
    else if (cw >= 1) foreign_work_canadian_work = 25
  } else if (fw >= 1) {
    if (cw >= 2) foreign_work_canadian_work = 25
    else if (cw >= 1) foreign_work_canadian_work = 13
  }

  let trade_certificate = 0
  if (p.has_trade_certificate === true) {
    if (minCLB >= 7) trade_certificate = 50
    else if (minCLB >= 5) trade_certificate = 25
  }

  const educationGroup = Math.min(education_language + education_canadian_work, 50)
  const foreignWorkGroup = Math.min(foreign_work_language + foreign_work_canadian_work, 50)
  const tradeGroup = Math.min(trade_certificate, 50)
  const skillSubtotal = Math.min(educationGroup + foreignWorkGroup + tradeGroup, 100)

  // ── Section D: Additional ─────────────────────────────────────────────────

  const provincial_nomination = p.has_provincial_nomination === true ? 600 : 0

  const allNclcGe7 = [p.nclc_reading, p.nclc_writing, p.nclc_speaking, p.nclc_listening]
    .every(v => (v ?? 0) >= 7)
  let french_skills = 0
  if (allNclcGe7) {
    const minEnglish = Math.min(
      p.clb_reading ?? 0, p.clb_writing ?? 0,
      p.clb_speaking ?? 0, p.clb_listening ?? 0,
    )
    french_skills = minEnglish >= 5 ? 50 : 25
  }

  const ceYears = p.canadian_education_years ?? 0
  let canadian_education = 0
  if (ceYears >= 3) canadian_education = 30
  else if (ceYears >= 1) canadian_education = 15

  const sibling = p.has_sibling_in_canada === true ? 15 : 0

  const additionalSubtotal = provincial_nomination + french_skills + canadian_education + sibling

  return {
    core: {
      age,
      education,
      first_language,
      second_language,
      canadian_work,
      subtotal: coreSubtotal,
    },
    spouse: {
      education: spouseEducation,
      language: spouseLanguage,
      canadian_work: spouseCanadianWork,
      subtotal: spouseSubtotal,
    },
    skill_transferability: {
      education_language,
      education_canadian_work,
      foreign_work_language,
      foreign_work_canadian_work,
      trade_certificate,
      subtotal: skillSubtotal,
    },
    additional: {
      provincial_nomination,
      french_skills,
      canadian_education,
      sibling,
      subtotal: additionalSubtotal,
    },
    total: coreSubtotal + spouseSubtotal + skillSubtotal + additionalSubtotal,
  }
}
