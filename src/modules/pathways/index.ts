import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createRequestLogger } from '@/lib/logger'
import { NotFoundError } from '@/lib/errors'
import type { PathwayEngineResult } from './types'
import { checkEligibility } from './lib/eligibilityChecker'
import { calculateCRS } from './lib/crsCalculator'
import { matchPathways } from './lib/pathwayMatcher'
import { generateTips } from './lib/scoreAdvisor'

/** Runs the full pathway matching engine for a user and persists the result. */
export async function runPathwayEngine(userId: string): Promise<PathwayEngineResult> {
  const correlationId = `pathway-engine-${userId}`
  const log = createRequestLogger(correlationId)
  const supabase = createSupabaseAdminClient()

  log.info({ action: 'pathway_engine.started', userId })

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    throw new NotFoundError(`Profile not found for userId: ${userId}`)
  }

  const eligibility = checkEligibility(profile)
  const breakdown = calculateCRS(profile)
  const matches = matchPathways(profile, eligibility, breakdown)
  const improvement_tips = generateTips(profile, breakdown)

  const topMatch = matches[0]
  const result: PathwayEngineResult = {
    user_id: userId,
    eligibility,
    matches,
    improvement_tips,
    calculated_at: new Date().toISOString(),
    data_completeness_warning: (profile.incomplete_fields?.length ?? 0) > 0,
  }

  await supabase.from('pathway_matches').upsert(
    {
      user_id: userId,
      result,
      crs_score: breakdown.total,
      top_pathway_id: topMatch?.pathway_id ?? null,
      calculated_at: result.calculated_at,
    },
    { onConflict: 'user_id' },
  )

  log.info({
    action: 'pathway_engine.completed',
    userId,
    crs_score: breakdown.total,
    matches: matches.length,
  })

  return result
}
