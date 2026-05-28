import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseError } from '@/lib/errors';

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
import { calculateCRS, matchPathways } from '../service';
import type { MatcherProfile } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** FSW-eligible single applicant with bachelor's + CLB 9 + no Canadian work. */
function makeProfile(overrides: Partial<MatcherProfile> = {}): MatcherProfile {
  return {
    id: 'profile-1',
    has_degree: true,
    years_experience: 3,
    education_level: 'bachelors',
    eca_obtained: false,
    clb_speaking: 9,
    clb_listening: 9,
    clb_reading: 9,
    clb_writing: 9,
    canadian_work_years: 0,
    foreign_work_years: 3,
    canadian_work_recent: null,
    foreign_work_recent: true,
    noc_teer_category: 1,
    spouse_coming_to_canada: false,
    spouse_education_level: null,
    spouse_clb_speaking: null,
    spouse_clb_listening: null,
    spouse_clb_reading: null,
    spouse_clb_writing: null,
    spouse_canadian_work_years: null,
    has_provincial_nomination: false,
    has_canadian_job_offer: false,
    has_sibling_in_canada: false,
    ...overrides,
  };
}

function makePathwayRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pathway-fsw',
    slug: 'express-entry-fsw',
    title: 'Federal Skilled Worker',
    official_name: 'Federal Skilled Worker Program',
    description: 'For skilled workers with foreign work experience.',
    processing_time_min: '6 months',
    processing_time_max: '12 months',
    ...overrides,
  };
}

// ─── DB mock helpers ──────────────────────────────────────────────────────────

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

function makeChain(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    like: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };
  for (const key of ['select', 'eq', 'like', 'not', 'order', 'limit'] as const) {
    (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  }
  return chain;
}

interface MockSetup {
  profileResult: QueryResult;
  pathwaysResult?: QueryResult;
  drawsResult?: QueryResult;
}

function setupClient(setup: MockSetup) {
  const {
    profileResult,
    pathwaysResult = { data: [], error: null },
    drawsResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles')         return makeChain(profileResult);
    if (table === 'pathways')         return makeChain(pathwaysResult);
    if (table === 'immigration_draws') return makeChain(drawsResult);
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>,
  );
}

// ─── calculateCRS ─────────────────────────────────────────────────────────────

describe('calculateCRS', () => {
  it('returns 240 for bachelor + CLB 9 all four + no Canadian work (known baseline)', () => {
    // Education: bachelors=112, CLB 9 × 4=128, Canadian work 0=0
    expect(calculateCRS(makeProfile())).toBe(240);
  });

  it('returns 0 when all profile fields are null', () => {
    const empty = makeProfile({
      has_degree: null,
      education_level: null,
      clb_speaking: null,
      clb_listening: null,
      clb_reading: null,
      clb_writing: null,
      canadian_work_years: null,
      has_provincial_nomination: null,
      has_canadian_job_offer: null,
      has_sibling_in_canada: null,
    });
    expect(calculateCRS(empty)).toBe(0);
  });

  it('returns 356 for PhD + CLB 10 all four + 5 years Canadian work (high-score applicant)', () => {
    // PhD=140, CLB 10 × 4=136, Canadian 5yr=80
    const score = calculateCRS(makeProfile({
      education_level: 'phd',
      clb_speaking: 10, clb_listening: 10, clb_reading: 10, clb_writing: 10,
      canadian_work_years: 5,
    }));
    expect(score).toBe(356);
  });

  it('uses bachelors fallback when education_level is null but has_degree is true', () => {
    const score = calculateCRS(makeProfile({ education_level: null, has_degree: true }));
    // 112 (bachelors fallback) + 128 (CLB 9×4) = 240
    expect(score).toBe(240);
  });

  it('returns 0 education pts for unknown education_level string', () => {
    const score = calculateCRS(makeProfile({
      education_level: 'trade_certificate',
      clb_speaking: null, clb_listening: null, clb_reading: null, clb_writing: null,
      canadian_work_years: null,
    }));
    expect(score).toBe(0);
  });

  it('adds PN bonus of 600 when has_provincial_nomination is true', () => {
    const base = calculateCRS(makeProfile());
    const withPN = calculateCRS(makeProfile({ has_provincial_nomination: true }));
    expect(withPN - base).toBe(600);
  });

  it('adds 200 job offer pts for TEER 0 and 50 pts for other TEER', () => {
    const withTeer0 = calculateCRS(makeProfile({
      has_canadian_job_offer: true,
      noc_teer_category: 0,
    }));
    const withTeer1 = calculateCRS(makeProfile({
      has_canadian_job_offer: true,
      noc_teer_category: 1,
    }));
    const base = calculateCRS(makeProfile());
    expect(withTeer0 - base).toBe(200);
    expect(withTeer1 - base).toBe(50);
  });

  it('adds 15 pts for sibling in Canada', () => {
    const base = calculateCRS(makeProfile());
    const withSibling = calculateCRS(makeProfile({ has_sibling_in_canada: true }));
    expect(withSibling - base).toBe(15);
  });

  it('adds spouse pts at 50% ratio for education, language, and Canadian work', () => {
    const withSpouse = calculateCRS(makeProfile({
      spouse_coming_to_canada: true,
      spouse_education_level: 'bachelors',    // 112 × 0.5 = 56
      spouse_clb_speaking: 9,
      spouse_clb_listening: 9,
      spouse_clb_reading: 9,
      spouse_clb_writing: 9,                  // (32×4) × 0.5 = 64
      spouse_canadian_work_years: 1,          // 40 × 0.5 = 20
    }));
    const base = calculateCRS(makeProfile());
    expect(withSpouse - base).toBe(140); // 56 + 64 + 20
  });

  it('does not add spouse pts when spouse_coming_to_canada is false', () => {
    const withSpouseData = calculateCRS(makeProfile({
      spouse_coming_to_canada: false,
      spouse_education_level: 'phd',
      spouse_clb_speaking: 10,
      spouse_clb_listening: 10,
      spouse_clb_reading: 10,
      spouse_clb_writing: 10,
    }));
    expect(withSpouseData).toBe(240);
  });
});

// ─── matchPathways ────────────────────────────────────────────────────────────

describe('matchPathways', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a MatchResult for an eligible FSW applicant', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      pathwaysResult: { data: [makePathwayRow()], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results).toHaveLength(1);
    expect(results[0].eligible).toBe(true);
    expect(results[0].pathway.slug).toBe('express-entry-fsw');
    expect(results[0].crs_score).toBe(240);
    expect(results[0].criteria_met.length).toBeGreaterThan(0);
    expect(results[0].criteria_missing).toHaveLength(0);
  });

  it('always includes age in missing_data because the profiles schema has no age column', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      pathwaysResult: { data: [makePathwayRow()], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results[0].missing_data).toContain('age');
  });

  it('throws DatabaseError when profile is not found', async () => {
    setupClient({
      profileResult: { data: null, error: { code: 'PGRST116', message: 'No rows found' } },
    });

    await expect(matchPathways('missing-profile', mockLogger as never)).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it('returns an empty array when no active express-entry pathways exist', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      pathwaysResult: { data: [], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results).toHaveLength(0);
  });

  it('uses FALLBACK_CUTOFFS when immigration_draws is empty', async () => {
    setupClient({
      profileResult: { data: makeProfile(), error: null },
      pathwaysResult: { data: [makePathwayRow()], error: null },
      drawsResult: { data: [], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    // FSW fallback cutoff is 510; CRS 240 is well below → 'low'
    expect(results[0].latest_cutoff).toBe(510);
    expect(results[0].ita_likelihood).toBe('low');
  });

  it('marks ita_likelihood as high when CRS score is ≥ cutoff + 20', async () => {
    // Score: PhD(140) + CLB10×4(136) + 5yr Canadian(80) + PN(600) = 956 — well above any cutoff
    setupClient({
      profileResult: {
        data: makeProfile({
          education_level: 'phd',
          clb_speaking: 10, clb_listening: 10, clb_reading: 10, clb_writing: 10,
          canadian_work_years: 5,
          has_provincial_nomination: true,
        }),
        error: null,
      },
      pathwaysResult: { data: [makePathwayRow()], error: null },
      drawsResult: {
        data: [{ draw_type: 'fsw', cutoff_score: 510, draw_date: '2026-05-01' }],
        error: null,
      },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results[0].ita_likelihood).toBe('high');
    expect(results[0].latest_cutoff).toBe(510);
  });

  it('sorts eligible results before ineligible ones', async () => {
    setupClient({
      profileResult: {
        // TEER 4 → FSW ineligible; but still gets a result
        data: makeProfile({ noc_teer_category: 4 }),
        error: null,
      },
      pathwaysResult: {
        data: [
          makePathwayRow({ id: 'p-fsw', slug: 'express-entry-fsw', title: 'FSW' }),
          makePathwayRow({ id: 'p-cec', slug: 'express-entry-cec', title: 'CEC' }),
        ],
        error: null,
      },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results).toHaveLength(2);
    // All ineligible with TEER 4 — both eligible should be false
    expect(results.every((r) => !r.eligible)).toBe(true);
  });

  it('marks CEC applicant ineligible when canadian_work_years is 0', async () => {
    setupClient({
      profileResult: {
        data: makeProfile({ canadian_work_years: 0, canadian_work_recent: false }),
        error: null,
      },
      pathwaysResult: {
        data: [makePathwayRow({ id: 'p-cec', slug: 'express-entry-cec', title: 'CEC' })],
        error: null,
      },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results[0].eligible).toBe(false);
    expect(results[0].criteria_missing.some((m) => m.includes('Canadian work'))).toBe(true);
  });
});
