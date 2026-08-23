import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, DatabaseError } from '@/lib/errors';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDashboardData, getDrawTypesForPathway, getFallbackDrawTypesForPathway, LATEST_DRAW_MAX_AGE_MONTHS } from '../service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    auth_user_id: 'user-1',
    full_name: 'Jane Smith',
    onboarding_status: 'complete',
    profile_completeness_pct: 85,
    incomplete_fields: [],
    eca_obtained: null,
    has_canadian_job_offer: false,
    canadian_work_years: 0,
    ...overrides,
  };
}

function makeApplication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    profile_id: 'profile-1',
    pathway_id: 'pathway-1',
    status: 'in_progress',
    submitted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    notes: null,
    pathway: {
      id: 'pathway-1',
      slug: 'skilled-worker',
      title: 'Skilled Worker',
      official_name: 'Federal Skilled Worker Program',
      processing_time_min: '6 months',
      processing_time_max: '12 months',
    },
    ...overrides,
  };
}

function makeStep(n = 1, overrides: Record<string, unknown> = {}) {
  return {
    id: `step-${n}`,
    pathway_id: 'pathway-1',
    step_number: n,
    title: `Step ${n}`,
    description: `Description for step ${n}`,
    estimated_duration: '2 weeks',
    is_optional: false,
    ...overrides,
  };
}

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

// Makes a chain that is thenable — queries ending with .limit(), .order(), or .eq()
// can be awaited directly without calling .single() or .maybeSingle().
function makeChain(result: QueryResult) {
  const selectFn = vi.fn();
  const eqFn = vi.fn();
  const inFn = vi.fn();
  const orderFn = vi.fn();
  const limitFn = vi.fn();
  const singleFn = vi.fn().mockResolvedValue(result);
  const maybeSingleFn = vi.fn().mockResolvedValue(result);

  // Makes the chain itself await-able (used by queries ending with limit/order/eq)
  const chain = {
    select: selectFn,
    eq: eqFn,
    in: inFn,
    order: orderFn,
    limit: limitFn,
    single: singleFn,
    maybeSingle: maybeSingleFn,
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };

  selectFn.mockReturnValue(chain);
  eqFn.mockReturnValue(chain);
  inFn.mockReturnValue(chain);
  orderFn.mockReturnValue(chain);
  limitFn.mockReturnValue(chain);

  return chain;
}

interface MockSetup {
  profileResult: QueryResult;
  applicationResult: QueryResult;
  stepsResult?: QueryResult;
  docsResult?: QueryResult;
  pathwaysResult?: QueryResult;
  progressResult?: QueryResult;
  /**
   * Result(s) for immigration_draws queries, consumed in call order. A single
   * value serves every call; an array lets a test give the primary-stream
   * query and a subsequent fallback-stream query different results.
   */
  drawsResult?: QueryResult | QueryResult[];
}

function setupClient(setup: MockSetup) {
  const {
    profileResult,
    applicationResult,
    stepsResult = { data: [], error: null },
    docsResult = { data: [], error: null },
    pathwaysResult = { data: [], error: null },
    progressResult = { data: [], error: null },
    drawsResult = { data: null, error: null },
  } = setup;

  const drawsResults = Array.isArray(drawsResult) ? drawsResult : [drawsResult];
  let drawsCallIndex = 0;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain(profileResult);
    if (table === 'applications') return makeChain(applicationResult);
    if (table === 'pathway_steps') return makeChain(stepsResult);
    if (table === 'application_documents') return makeChain(docsResult);
    if (table === 'pathways') return makeChain(pathwaysResult);
    if (table === 'pathway_progress') return makeChain(progressResult);
    if (table === 'immigration_draws') {
      const result = drawsResults[drawsCallIndex] ?? drawsResults[drawsResults.length - 1];
      drawsCallIndex += 1;
      return makeChain(result);
    }
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns onboarding_incomplete state when profile is not complete', async () => {
    setupClient({
      profileResult: { data: makeProfile({ onboarding_status: 'in_progress' }), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);

    expect(result.state).toBe('onboarding_incomplete');
    expect(result.firstName).toBe('Jane');
    expect(result.avatarInitials).toBe('JS');
  });

  it('returns pathway_not_selected when onboarding complete but no application', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: null, error: null },
      pathwaysResult: {
        data: [
          {
            id: 'p-1',
            title: 'Skilled Worker',
            official_name: 'FSW',
            processing_time_min: '6 months',
            processing_time_max: '12 months',
          },
        ],
        error: null,
      },
    });

    const result = await getDashboardData('user-1', mockLogger as never);

    expect(result.state).toBe('pathway_not_selected');
    expect(result.recommendedPathways).toHaveLength(1);
    expect(result.recommendedPathways[0].processingTime).toBe('6 months–12 months');
  });

  it('returns application_in_progress when application has no submitted_at', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: makeApplication(), error: null },
      stepsResult: { data: [makeStep(1), makeStep(2)], error: null },
      docsResult: { data: [], error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);

    expect(result.state).toBe('application_in_progress');
    expect(result.pathwayTitle).toBe('Skilled Worker');
    expect(result.totalStepsCount).toBe(2);
    expect(result.applicationSteps[0].status).toBe('current');
    expect(result.applicationSteps[1].status).toBe('upcoming');
    expect(result.applicationPathwaySlug).toBe('skilled-worker');
  });

  it('advances the current step when a pathway_progress row marks step 1 complete', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: makeApplication(), error: null },
      stepsResult: { data: [makeStep(1), makeStep(2)], error: null },
      docsResult: { data: [], error: null },
      progressResult: { data: [{ step_id: 'step-1', status: 'complete' }], error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);

    expect(result.applicationSteps[0].status).toBe('complete');
    expect(result.applicationSteps[1].status).toBe('current');
    expect(result.completedStepsCount).toBe(1);
  });

  it('carries enrichment columns into application steps', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: makeApplication(), error: null },
      stepsResult: {
        data: [makeStep(1, {
          checklist_items: ['Gather passport', 'Book test'],
          pro_tips: 'Apply early.',
          fee_cad: 850,
          common_mistakes: ['Wrong photo size'],
          what_happens_next: 'IRCC reviews your submission.',
          validity_period: 'ITA valid for 60 days',
          applicant_portal: 'https://www.canada.ca/account.html',
        })],
        error: null,
      },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    const step = result.applicationSteps[0];

    expect(step.checklistItems).toEqual([
      { label: 'Gather passport', detail: 'Gather passport' },
      { label: 'Book test', detail: 'Book test' },
    ]);
    expect(step.proTips).toBe('Apply early.');
    expect(step.feeCad).toBe(850);
    expect(step.commonMistakes).toEqual(['Wrong photo size']);
    expect(step.whatHappensNext).toBe('IRCC reviews your submission.');
    expect(step.validityPeriod).toBe('ITA valid for 60 days');
    expect(step.applicantPortal).toBe('https://www.canada.ca/account.html');
  });

  it('returns application_submitted when submitted_at is set', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: {
        data: makeApplication({ submitted_at: '2026-05-01T00:00:00Z' }),
        error: null,
      },
      stepsResult: { data: [makeStep(1)], error: null },
      docsResult: { data: [], error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);

    expect(result.state).toBe('application_submitted');
    expect(result.applicationSubmittedAt).toBe('2026-05-01T00:00:00Z');
    expect(result.applicationSteps[0].status).toBe('complete');
  });

  it('throws NotFoundError when profile does not exist', async () => {
    setupClient({
      profileResult: { data: null, error: { code: 'PGRST116', message: 'No rows found' } },
      applicationResult: { data: null, error: null },
    });

    await expect(getDashboardData('user-missing', mockLogger as never)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('throws DatabaseError on unexpected profile query failure', async () => {
    setupClient({
      profileResult: { data: null, error: { message: 'connection timeout' } },
      applicationResult: { data: null, error: null },
    });

    await expect(getDashboardData('user-1', mockLogger as never)).rejects.toBeInstanceOf(
      DatabaseError
    );
  });

  it('derives firstName as first word of full_name', async () => {
    setupClient({
      profileResult: { data: makeProfile({ full_name: 'Mohammed Al-Rashidi' }), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.firstName).toBe('Mohammed');
  });

  it('returns "there" as firstName when full_name is null', async () => {
    setupClient({
      profileResult: { data: makeProfile({ full_name: null }), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.firstName).toBe('there');
  });

  it('derives avatarInitials from first and last name', async () => {
    setupClient({
      profileResult: { data: makeProfile({ full_name: 'Carlos Reyes' }), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.avatarInitials).toBe('CR');
  });

  it('marks onboarding steps complete when their fields are not in incomplete_fields', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({
          onboarding_status: 'in_progress',
          incomplete_fields: ['education_level', 'clb_listening'],
        }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    const personal = result.onboardingSteps.find((s) => s.id === 'personal');
    const education = result.onboardingSteps.find((s) => s.id === 'education');
    expect(personal?.completed).toBe(true);
    expect(education?.completed).toBe(false);
  });

  it('calculates pending and completed document counts from mandatory docs', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: makeApplication(), error: null },
      stepsResult: { data: [makeStep(1)], error: null },
      docsResult: {
        data: [
          { id: 'd1', status: 'uploaded', requirement: { name: 'Passport', is_mandatory: true } },
          { id: 'd2', status: 'pending', requirement: { name: 'ECA', is_mandatory: true } },
          { id: 'd3', status: 'uploaded', requirement: { name: 'Cover letter', is_mandatory: false } },
        ],
        error: null,
      },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.completedDocumentsCount).toBe(1);
    expect(result.pendingDocumentsCount).toBe(1);
  });

  it('derives ECA recommendation when eca_obtained is null', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({ eca_obtained: null, has_canadian_job_offer: true, canadian_work_years: 1 }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    const ecaRec = result.recommendations.find((r) => r.id === 'eca');
    expect(ecaRec).toBeDefined();
  });

  it('uses profile_completeness_pct as profileCompleteness, defaulting to 0 when null', async () => {
    setupClient({
      profileResult: { data: makeProfile({ profile_completeness_pct: null }), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.profileCompleteness).toBe(0);
  });

  it('returns single-word avatarInitials when full_name has no space', async () => {
    setupClient({
      profileResult: { data: makeProfile({ full_name: 'Cher' }), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.avatarInitials).toBe('C');
  });

  it('extracts crsScore from nested PathwayInput shape (object with range_low/range_high)', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({
          pathway_input_json: {
            crs_estimate: { range_low: 440, range_high: 480, confidence: 'low', based_on: [] },
          },
        }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.crsScore).toBe(460);
    expect(result.crsRangeLow).toBe(440);
    expect(result.crsRangeHigh).toBe(480);
    expect(result.crsConfidence).toBe('low');
  });

  it('extracts crsScore from CrsEstimate shape (score/low/high — written by recalculateCrsEstimate)', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({
          pathway_input_json: {
            crs_estimate: { score: 432, low: 412, high: 452, margin: 20, breakdown: {} },
            crs_recalculated_at: '2026-06-21T16:52:04.295Z',
          },
        }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.crsScore).toBe(432);
    expect(result.crsRangeLow).toBe(412);
    expect(result.crsRangeHigh).toBe(452);
  });

  it('extracts crsScore from flat shape (scalar number + crs_estimate_low/high)', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({
          pathway_input_json: {
            crs_estimate: 460,
            crs_estimate_low: 440,
            crs_estimate_high: 480,
          },
        }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.crsScore).toBe(460);
    expect(result.crsRangeLow).toBe(440);
    expect(result.crsRangeHigh).toBe(480);
  });

  it('returns null crsScore when pathway_input_json is null', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({ pathway_input_json: null }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.crsScore).toBeNull();
    expect(result.crsRangeLow).toBeNull();
    expect(result.crsRangeHigh).toBeNull();
  });

  it('computes a live CRS breakdown and CLB counterfactual delta from profile columns', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({
          date_of_birth: '1994-01-01',
          education_level: 'bachelors',
          clb_speaking: 8,
          clb_listening: 8,
          clb_reading: 8,
          clb_writing: 8,
          canadian_work_years: 2,
        }),
        error: null,
      },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.crsBreakdown).not.toBeNull();
    expect(result.crsBreakdown?.education).toBe(120);
    expect(result.crsClbPlusOneDelta).toBeGreaterThan(0);
  });

  it('returns null breakdown and delta when profile columns are too sparse to estimate', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.crsBreakdown).toBeNull();
    expect(result.crsClbPlusOneDelta).toBeNull();
  });

  // ─── Latest draw: taxonomy + recency guard ─────────────────────────────────

  it('resolves a non-null latest draw for a CEC pathway when a live cec draw exists', async () => {
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);
    const drawDate = recentDate.toISOString().slice(0, 10);

    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: {
        data: makeApplication({
          pathway: {
            id: 'pathway-1',
            slug: 'canadian-experience-class',
            title: 'Canadian Experience Class',
            official_name: 'Canadian Experience Class',
            processing_time_min: '6 months',
            processing_time_max: '12 months',
          },
        }),
        error: null,
      },
      drawsResult: {
        data: { cutoff_score: 516, draw_date: drawDate, draw_type: 'cec', invitations_issued: 4000 },
        error: null,
      },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.latestDraw).not.toBeNull();
    expect(result.latestDraw?.cutoffScore).toBe(516);
    expect(result.latestDraw?.drawType).toBe('cec');
  });

  it('null-degrades a stale draw so a defunct cutoff never renders as a live reference', async () => {
    const staleDate = new Date();
    staleDate.setMonth(staleDate.getMonth() - (LATEST_DRAW_MAX_AGE_MONTHS + 2));
    const drawDate = staleDate.toISOString().slice(0, 10);

    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: makeApplication(), error: null },
      drawsResult: {
        data: { cutoff_score: 529, draw_date: drawDate, draw_type: 'general', invitations_issued: 2095 },
        error: null,
      },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.latestDraw).toBeNull();
  });

  it('keeps a draw dated inside the recency window', async () => {
    const insideWindow = new Date();
    insideWindow.setMonth(insideWindow.getMonth() - (LATEST_DRAW_MAX_AGE_MONTHS - 1));
    const drawDate = insideWindow.toISOString().slice(0, 10);

    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: { data: makeApplication(), error: null },
      drawsResult: {
        data: { cutoff_score: 500, draw_date: drawDate, draw_type: 'general', invitations_issued: 3000 },
        error: null,
      },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.latestDraw?.cutoffScore).toBe(500);
  });

  it('falls back to the nearest comparable stream when the pathway stream has no live cutoff', async () => {
    const staleDate = new Date();
    staleDate.setMonth(staleDate.getMonth() - (LATEST_DRAW_MAX_AGE_MONTHS + 2));
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);

    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: {
        data: makeApplication({
          pathway: {
            id: 'pathway-1',
            slug: 'canada-express-entry-fsw',
            title: 'Federal Skilled Worker',
            official_name: 'Federal Skilled Worker Program',
            processing_time_min: '6 months',
            processing_time_max: '12 months',
          },
        }),
        error: null,
      },
      drawsResult: [
        // Primary (fsw/general) query: stale.
        {
          data: { cutoff_score: 529, draw_date: staleDate.toISOString().slice(0, 10), draw_type: 'general', invitations_issued: 2095 },
          error: null,
        },
        // Fallback (cec) query: fresh.
        {
          data: { cutoff_score: 516, draw_date: recentDate.toISOString().slice(0, 10), draw_type: 'cec', invitations_issued: 4000 },
          error: null,
        },
      ],
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.latestDraw).not.toBeNull();
    expect(result.latestDraw?.drawType).toBe('cec');
    expect(result.latestDraw?.cutoffScore).toBe(516);
    expect(result.latestDraw?.isFallback).toBe(true);
  });

  it('null-degrades when both the primary and fallback streams have no live cutoff', async () => {
    const staleDate = new Date();
    staleDate.setMonth(staleDate.getMonth() - (LATEST_DRAW_MAX_AGE_MONTHS + 2));
    const drawDate = staleDate.toISOString().slice(0, 10);

    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: {
        data: makeApplication({
          pathway: {
            id: 'pathway-1',
            slug: 'canada-express-entry-fsw',
            title: 'Federal Skilled Worker',
            official_name: 'Federal Skilled Worker Program',
            processing_time_min: '6 months',
            processing_time_max: '12 months',
          },
        }),
        error: null,
      },
      drawsResult: [
        { data: { cutoff_score: 529, draw_date: drawDate, draw_type: 'general', invitations_issued: 2095 }, error: null },
        { data: { cutoff_score: 502, draw_date: drawDate, draw_type: 'cec', invitations_issued: 3000 }, error: null },
      ],
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.latestDraw).toBeNull();
  });

  it('never falls back for a stream that already has its own live draws', async () => {
    const recentDate = new Date();
    recentDate.setMonth(recentDate.getMonth() - 1);

    setupClient({
      profileResult: { data: makeProfile(), error: null },
      applicationResult: {
        data: makeApplication({
          pathway: {
            id: 'pathway-1',
            slug: 'canadian-experience-class',
            title: 'Canadian Experience Class',
            official_name: 'Canadian Experience Class',
            processing_time_min: '6 months',
            processing_time_max: '12 months',
          },
        }),
        error: null,
      },
      drawsResult: { data: null, error: null },
    });

    const result = await getDashboardData('user-1', mockLogger as never);
    expect(result.latestDraw).toBeNull();
  });
});

describe('getDrawTypesForPathway', () => {
  it('maps FSW slugs to the stored fsw and general slugs', () => {
    expect(getDrawTypesForPathway('canada-express-entry-fsw')).toEqual(['fsw', 'general']);
    expect(getDrawTypesForPathway('federal-skilled-worker')).toEqual(['fsw', 'general']);
  });

  it('maps CEC slugs to the stored cec and general slugs', () => {
    expect(getDrawTypesForPathway('canadian-experience-class')).toEqual(['cec', 'general']);
  });

  it('maps trades and provincial slugs to their stored slugs', () => {
    expect(getDrawTypesForPathway('federal-skilled-trades')).toEqual(['fst', 'trades']);
    expect(getDrawTypesForPathway('ontario-pnp')).toEqual(['pnp']);
  });

  it('falls back to general and fsw for unknown or missing slugs', () => {
    expect(getDrawTypesForPathway('express-entry')).toEqual(['general', 'fsw']);
    expect(getDrawTypesForPathway(null)).toEqual(['general', 'fsw']);
  });
});

describe('getFallbackDrawTypesForPathway', () => {
  it('falls back to CEC for FSW slugs, since it ranks the same CRS pool without a nomination bonus', () => {
    expect(getFallbackDrawTypesForPathway('canada-express-entry-fsw')).toEqual(['cec']);
    expect(getFallbackDrawTypesForPathway('federal-skilled-worker')).toEqual(['cec']);
  });

  it('falls back to CEC for unknown or missing slugs, matching their general/fsw primary default', () => {
    expect(getFallbackDrawTypesForPathway('express-entry')).toEqual(['cec']);
    expect(getFallbackDrawTypesForPathway(null)).toEqual(['cec']);
  });

  it('has no fallback for streams that already have their own live draws', () => {
    expect(getFallbackDrawTypesForPathway('canadian-experience-class')).toEqual([]);
    expect(getFallbackDrawTypesForPathway('federal-skilled-trades')).toEqual([]);
    expect(getFallbackDrawTypesForPathway('ontario-pnp')).toEqual([]);
  });
});
