import type { Database } from '@/types/database'
import type { CRSBreakdown, ScoreImprovementTip } from '../types'

type Profile = Database['public']['Tables']['profiles']['Row']

/** Generates actionable CRS improvement tips sorted by estimated points gain. */
export function generateTips(
  profile: Profile,
  _breakdown: CRSBreakdown,
): ScoreImprovementTip[] {
  const tips: ScoreImprovementTip[] = []

  const clbScores = [profile.clb_reading, profile.clb_writing, profile.clb_speaking, profile.clb_listening]
  const anyClbBelow9 = clbScores.some(v => (v ?? 0) < 9)
  if (anyClbBelow9) {
    tips.push({
      action: 'Retake your language test aiming for CLB 9 in all abilities',
      points_gain_estimate: 30,
      difficulty: 'medium',
      timeframe: '3–6 months',
    })
  }

  if (!profile.canadian_work_years) {
    tips.push({
      action: 'Gaining Canadian work experience unlocks CEC eligibility and skill transferability points',
      points_gain_estimate: 40,
      difficulty: 'hard',
      timeframe: '12 months minimum',
    })
  }

  const nclcScores = [profile.nclc_reading, profile.nclc_writing, profile.nclc_speaking, profile.nclc_listening]
  const anyNclcLow = nclcScores.some(v => v === null || v < 7)
  if (anyNclcLow) {
    tips.push({
      action: 'Achieving NCLC 7+ in French adds 25–50 bonus CRS points',
      points_gain_estimate: 25,
      difficulty: 'hard',
      timeframe: '6–18 months',
    })
  }

  if (!profile.canadian_education_years) {
    tips.push({
      action: 'A 1–2 year Canadian post-secondary credential adds education bonus points',
      points_gain_estimate: 15,
      difficulty: 'hard',
      timeframe: '1–2 years',
    })
  }

  if (!profile.has_provincial_nomination) {
    tips.push({
      action: 'A Provincial Nominee Program nomination adds 600 CRS points, virtually guaranteeing an invitation',
      points_gain_estimate: 600,
      difficulty: 'medium',
      timeframe: '3–12 months depending on province',
    })
  }

  return tips.sort((a, b) => b.points_gain_estimate - a.points_gain_estimate)
}
