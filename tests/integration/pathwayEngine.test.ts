import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { runPathwayEngine } from '@/modules/pathways/index'
import type { Database } from '@/types/database'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_LOCAL_URL || 'http://127.0.0.1:54321'
const DEFAULT_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const SERVICE_KEY = process.env.SUPABASE_LOCAL_SECRET_KEY || DEFAULT_SERVICE_KEY

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY)

let testUserId: string
let testProfileId: string

const testEmail = `pathway-engine-test-${Date.now()}@example.com`

beforeAll(async () => {
  // Route the engine's admin client to the local Supabase instance
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  process.env.SUPABASE_SECRET_KEY = SERVICE_KEY

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: testEmail,
    password: 'TestPassword123!',
    email_confirm: true,
  })
  if (userError) throw userError
  testUserId = userData.user.id

  const { data: profileData, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', testUserId)
    .single()
  if (profileError) throw profileError
  testProfileId = profileData.id

  await admin.from('profiles').update({
    education_level: 'bachelors',
    clb_reading: 9, clb_writing: 9, clb_speaking: 9, clb_listening: 9,
    foreign_work_years: 2,
    canadian_work_years: 1,
    noc_teer_category: 1,
    has_canadian_job_offer: false,
    has_trade_certificate: false,
    has_provincial_nomination: false,
    has_sibling_in_canada: false,
    spouse_coming_to_canada: false,
  }).eq('id', testProfileId)
})

afterAll(async () => {
  if (testProfileId) {
    await admin.from('pathway_matches').delete().eq('user_id', testProfileId)
    await admin.from('profiles').delete().eq('id', testProfileId)
  }
  if (testUserId) {
    await admin.auth.admin.deleteUser(testUserId)
  }
})

describe('runPathwayEngine', () => {
  it('reads seeded profile and returns a result with matches', async () => {
    const result = await runPathwayEngine(testProfileId)

    expect(result.user_id).toBe(testProfileId)
    expect(result.eligibility).toHaveLength(3)
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.calculated_at).toBeTruthy()
    expect(typeof result.data_completeness_warning).toBe('boolean')
  })

  it('writes result to pathway_matches table', async () => {
    await runPathwayEngine(testProfileId)

    const { data, error } = await admin
      .from('pathway_matches')
      .select('*')
      .eq('user_id', testProfileId)
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.crs_score).toBeGreaterThan(0)
    expect(data!.result).toBeTruthy()
  })

  it('running twice upserts rather than creating duplicates', async () => {
    await runPathwayEngine(testProfileId)
    await runPathwayEngine(testProfileId)

    const { data, error } = await admin
      .from('pathway_matches')
      .select('id')
      .eq('user_id', testProfileId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('throws NotFoundError for unknown userId', async () => {
    await expect(
      runPathwayEngine('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Profile not found')
  })

  it('eligible programs appear in matches', async () => {
    const result = await runPathwayEngine(testProfileId)
    const programs = result.matches.map(m => m.program)
    expect(programs).toContain('cec')
  })

  it('improvement_tips are sorted by points_gain_estimate descending', async () => {
    const result = await runPathwayEngine(testProfileId)
    const tips = result.improvement_tips
    for (let i = 1; i < tips.length; i++) {
      expect(tips[i - 1].points_gain_estimate).toBeGreaterThanOrEqual(tips[i].points_gain_estimate)
    }
  })
})
