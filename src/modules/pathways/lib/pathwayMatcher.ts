import type { Database } from '@/types/database'
import type { EligibilityResult, CRSBreakdown, PathwayMatch, Competitiveness } from '../types'
import { PATHWAY_DEFINITIONS } from '../constants/pathwayDefinitions'
import { getRecentCutoff } from '../constants/drawHistory'

type Profile = Database['public']['Tables']['profiles']['Row']

const COMPETITIVENESS_ORDER: Record<Competitiveness, number> = {
  strong: 0,
  competitive: 1,
  below_cutoff: 2,
}

/** Matches eligible programs to pathway definitions with CRS competitiveness ratings. */
export function matchPathways(
  _profile: Profile,
  eligibility: EligibilityResult[],
  breakdown: CRSBreakdown,
): PathwayMatch[] {
  const matches: PathwayMatch[] = []

  for (const result of eligibility) {
    if (!result.eligible) continue

    const definition = PATHWAY_DEFINITIONS.find(d => d.program === result.program)
    if (!definition) continue

    const cutoff = getRecentCutoff(result.program)
    const score = breakdown.total

    let competitiveness: Competitiveness
    if (score >= cutoff + 20) competitiveness = 'strong'
    else if (score >= cutoff - 20) competitiveness = 'competitive'
    else competitiveness = 'below_cutoff'

    matches.push({
      pathway_id: definition.id,
      program: result.program,
      name: definition.name,
      description: definition.description,
      crs_score: score,
      crs_breakdown: breakdown,
      recent_cutoff: cutoff,
      competitiveness,
      processing_months_estimate: definition.processing_months_estimate,
      next_steps: definition.next_steps,
    })
  }

  return matches.sort((a, b) => {
    const tierDiff = COMPETITIVENESS_ORDER[a.competitiveness] - COMPETITIVENESS_ORDER[b.competitiveness]
    if (tierDiff !== 0) return tierDiff
    return a.processing_months_estimate - b.processing_months_estimate
  })
}
