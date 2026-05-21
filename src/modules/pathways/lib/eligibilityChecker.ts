import type { Database } from '@/types/database'
import type { EligibilityResult } from '../types'

type Profile = Database['public']['Tables']['profiles']['Row']

/** Fields present in the spec but not yet in the DB schema.
 *  These will be provided once the profiles migration adds them. */
type ProfileExtensions = {
  age?: number | null
  foreign_work_recent?: boolean | null
  canadian_work_recent?: boolean | null
}

type ExtendedProfile = Profile & ProfileExtensions

/** FSW six-factor selection grid score (max 100, need >= 67). */
function fswGridScore(p: ExtendedProfile): number {
  // Age (max 12)
  const age = p.age ?? null
  let agePoints = 0
  if (age !== null) {
    if (age >= 18 && age <= 35) agePoints = 12
    else if (age === 36) agePoints = 11
    else if (age === 37) agePoints = 10
    else if (age === 38) agePoints = 9
    else if (age === 39) agePoints = 8
    else if (age === 40) agePoints = 7
    else if (age === 41) agePoints = 6
    else if (age === 42) agePoints = 5
    else if (age === 43) agePoints = 4
    else if (age === 44) agePoints = 3
    else if (age === 45) agePoints = 2
    else if (age === 46) agePoints = 1
  }

  // Education (max 25)
  const eduMap: Record<string, number> = {
    less_than_secondary: 0, secondary: 5,
    one_year_post_secondary: 15, two_year_post_secondary: 19,
    bachelors: 21, two_or_more_credentials: 22,
    masters: 23, phd: 25,
  }
  const eduPoints = p.education_level ? (eduMap[p.education_level] ?? 0) : 0

  // Language — first official (max 24, 6 pts per ability at CLB 9+)
  const clbAbilities = [p.clb_reading, p.clb_writing, p.clb_speaking, p.clb_listening]
  const langFirstPoints = clbAbilities.reduce<number>((sum, clb) => {
    const v = clb ?? 0
    if (v >= 9) return sum + 6
    if (v === 8) return sum + 5
    if (v === 7) return sum + 4
    if (v >= 5) return sum + 2
    if (v >= 4) return sum + 1
    return sum
  }, 0)

  // Language — second official (max 4, only if all first-lang CLB >= 7)
  const firstLangMin = Math.min(...clbAbilities.map(c => c ?? 0))
  let langSecondPoints = 0
  if (firstLangMin >= 7) {
    const nclcAbilities = [p.nclc_reading, p.nclc_writing, p.nclc_speaking, p.nclc_listening]
    const raw = nclcAbilities.reduce<number>((sum, clb) => {
      const v = clb ?? 0
      if (v >= 9) return sum + 3
      if (v >= 7) return sum + 2
      if (v >= 5) return sum + 1
      return sum
    }, 0)
    langSecondPoints = Math.min(raw, 4)
  }

  // Work experience (max 15)
  const fw = p.foreign_work_years ?? 0
  let workPoints = 0
  if (fw >= 4) workPoints = 15
  else if (fw === 3) workPoints = 13
  else if (fw === 2) workPoints = 11
  else if (fw >= 1) workPoints = 9

  // Arranged employment (max 10)
  const employmentPoints = p.has_canadian_job_offer === true ? 10 : 0

  // Adaptability (max 10)
  let adaptPoints = 0
  if (p.spouse_coming_to_canada === true) {
    const spouseClbs = [p.spouse_clb_reading, p.spouse_clb_writing, p.spouse_clb_speaking, p.spouse_clb_listening]
    const spouseMaxClb = Math.max(...spouseClbs.map(c => c ?? 0))
    if (spouseMaxClb >= 4) adaptPoints += 5
  }
  if ((p.canadian_education_years ?? 0) >= 1) adaptPoints += 5
  if ((p.canadian_work_years ?? 0) >= 1) adaptPoints += 5
  if (p.has_sibling_in_canada === true) adaptPoints += 5
  adaptPoints = Math.min(adaptPoints, 10)

  return agePoints + eduPoints + langFirstPoints + langSecondPoints + workPoints + employmentPoints + adaptPoints
}

/** Check Express Entry eligibility for FSW, CEC, and FST programs. */
export function checkEligibility(profile: Profile): EligibilityResult[] {
  const p = profile as ExtendedProfile

  // ── FSW ──────────────────────────────────────────────────────────────────
  const fswReasons: string[] = []
  const fswMissing: string[] = []

  const fw = p.foreign_work_years ?? 0
  if (fw < 1) fswReasons.push('Requires at least 1 year of foreign skilled work experience')

  if (p.foreign_work_recent === false) {
    fswReasons.push('Foreign work experience must be within the last 10 years')
  } else if (p.foreign_work_recent === undefined || p.foreign_work_recent === null) {
    fswMissing.push('foreign_work_recent')
  }

  const teer = p.noc_teer_category
  if (teer === null || teer === undefined || ![0, 1, 2, 3].includes(teer)) {
    fswReasons.push('Occupation must be NOC TEER 0, 1, 2, or 3')
  }

  const clbMin = Math.min(
    p.clb_reading ?? 0, p.clb_writing ?? 0,
    p.clb_speaking ?? 0, p.clb_listening ?? 0,
  )
  if (clbMin < 7) {
    fswReasons.push(`Language minimum is CLB 7 in all abilities (lowest score: ${clbMin})`)
  }

  if (!p.education_level || p.education_level === 'less_than_secondary') {
    fswReasons.push('Education level must be at least secondary school')
  }

  const gridScore = fswGridScore(p)
  if (gridScore < 67) {
    fswReasons.push(`FSW selection grid score ${gridScore}/100 is below the 67-point minimum`)
  } else {
    fswReasons.push(`FSW selection grid score: ${gridScore}/100`)
  }

  const fswEligible = fswReasons.filter(r => !r.startsWith('FSW selection grid score:')).length === 0 && gridScore >= 67

  // ── CEC ──────────────────────────────────────────────────────────────────
  const cecReasons: string[] = []
  const cecMissing: string[] = []

  const cw = p.canadian_work_years ?? 0
  if (cw < 1) cecReasons.push('Requires at least 1 year of Canadian skilled work experience')

  if (p.canadian_work_recent === false) {
    cecReasons.push('Canadian work experience must be within the last 3 years')
  } else if (p.canadian_work_recent === undefined || p.canadian_work_recent === null) {
    cecMissing.push('canadian_work_recent')
  }

  const cecTeer = p.noc_teer_category
  if (cecTeer === null || cecTeer === undefined) {
    cecMissing.push('noc_teer_category')
  } else if ([0, 1, 2].includes(cecTeer)) {
    const cecClbMin = Math.min(
      p.clb_reading ?? 0, p.clb_writing ?? 0,
      p.clb_speaking ?? 0, p.clb_listening ?? 0,
    )
    if (cecClbMin < 7) {
      cecReasons.push(`NOC TEER 0/1/2 requires CLB 7 in all abilities (lowest: ${cecClbMin})`)
    }
  } else if (cecTeer === 3) {
    const cecClbMin = Math.min(
      p.clb_reading ?? 0, p.clb_writing ?? 0,
      p.clb_speaking ?? 0, p.clb_listening ?? 0,
    )
    if (cecClbMin < 5) {
      cecReasons.push(`NOC TEER 3 requires CLB 5 in all abilities (lowest: ${cecClbMin})`)
    }
  } else {
    cecReasons.push('Occupation must be NOC TEER 0, 1, 2, or 3')
  }

  const cecEligible = cecReasons.length === 0

  // ── FST ──────────────────────────────────────────────────────────────────
  const fstReasons: string[] = []
  const fstMissing: string[] = []

  const fstFw = p.foreign_work_years ?? 0
  if (fstFw < 2) fstReasons.push('Requires at least 2 years of foreign work experience in a designated trade')

  if (p.has_trade_certificate !== true && p.has_canadian_job_offer !== true) {
    fstReasons.push('Requires a valid Canadian job offer or a provincial/territorial trade certificate')
  }

  const fstSpeak = p.clb_speaking ?? 0
  const fstListen = p.clb_listening ?? 0
  const fstRead = p.clb_reading ?? 0
  const fstWrite = p.clb_writing ?? 0

  if (fstSpeak < 5 || fstListen < 5) {
    fstReasons.push(`CLB 5 required for speaking and listening (scores: speaking ${fstSpeak}, listening ${fstListen})`)
  }
  if (fstRead < 4 || fstWrite < 4) {
    fstReasons.push(`CLB 4 required for reading and writing (scores: reading ${fstRead}, writing ${fstWrite})`)
  }

  if (p.noc_teer_category === null || p.noc_teer_category === undefined) {
    fstMissing.push('noc_teer_category')
  }

  const fstEligible = fstReasons.length === 0

  return [
    { program: 'fsw', eligible: fswEligible, reasons: fswReasons, missing_criteria: fswMissing },
    { program: 'cec', eligible: cecEligible, reasons: cecReasons, missing_criteria: cecMissing },
    { program: 'fst', eligible: fstEligible, reasons: fstReasons, missing_criteria: fstMissing },
  ]
}
