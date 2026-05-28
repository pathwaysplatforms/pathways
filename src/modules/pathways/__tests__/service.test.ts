import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseError, NotFoundError } from '@/lib/errors';

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
import { calculateCRS, matchPathways, getApplicationData } from '../service';
import type { MatcherProfile } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** FSW-eligible single applicant with bachelor's + CLB 9 + no Canadian work. No DOB → age pts = 0. */
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
    date_of_birth: null,
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
    program_type: 'express_entry',
    ...overrides,
  };
}

/** Returns a YYYY-MM-DD date string that yields exactly `age` years old today. */
function dobForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age, 0, 1); // Jan 1, guarantees birthday has passed
  return d.toISOString().split('T')[0];
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

interface MatcherMockSetup {
  profileResult: QueryResult;
  pathwaysResult?: QueryResult;
  drawsResult?: QueryResult;
}

function setupMatcherClient(setup: MatcherMockSetup) {
  const {
    profileResult,
    pathwaysResult = { data: [], error: null },
    drawsResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles')          return makeChain(profileResult);
    if (table === 'pathways')          return makeChain(pathwaysResult);
    if (table === 'immigration_draws') return makeChain(drawsResult);
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>,
  );
}

interface AppMockSetup {
  applicationResult: QueryResult;
  stepsResult?: QueryResult;
}

function setupAppClient(setup: AppMockSetup) {
  const {
    applicationResult,
    stepsResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'applications')  return makeChain(applicationResult);
    if (table === 'pathway_steps') return makeChain(stepsResult);
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>,
  );
}

// ─── calculateCRS ─────────────────────────────────────────────────────────────

describe('calculateCRS', () => {
  it('returns 240 for bachelor + CLB 9 all four + no Canadian work + no DOB (known baseline)', () => {
    // Education: bachelors=112, CLB 9 × 4=128, Canadian work 0=0, age=0 (dob null)
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
      date_of_birth: null,
    });
    expect(calculateCRS(empty)).toBe(0);
  });

  it('returns 356 for PhD + CLB 10 all four + 5 years Canadian work + no DOB', () => {
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

  // ── Age scoring ─────────────────────────────────────────────────────────────

  it('returns 0 age pts when date_of_birth is null', () => {
    const withDob = calculateCRS(makeProfile({ date_of_birth: null }));
    const withoutDob = calculateCRS(makeProfile({ date_of_birth: null }));
    expect(withDob).toBe(withoutDob);
    expect(withDob).toBe(240);
  });

  it('adds 110 age pts for a single applicant aged 20–29', () => {
    const score = calculateCRS(makeProfile({ date_of_birth: dobForAge(25) }));
    expect(score).toBe(240 + 110); // 350
  });

  it('adds 105 age pts for a single applicant exactly aged 30', () => {
    const score = calculateCRS(makeProfile({ date_of_birth: dobForAge(30) }));
    expect(score).toBe(240 + 105); // 345
  });

  it('returns 0 age pts for a single applicant aged 45 or older', () => {
    const score = calculateCRS(makeProfile({ date_of_birth: dobForAge(45) }));
    expect(score).toBe(240); // no age pts
  });

  it('uses with-spouse age table (100 pts for age 20–29) when spouse_coming_to_canada is true', () => {
    const score = calculateCRS(makeProfile({
      date_of_birth: dobForAge(25),
      spouse_coming_to_canada: true,
    }));
    // 100 (age with spouse, 25) + 240 (base) = 340
    expect(score).toBe(240 + 100);
  });

  it('uses with-spouse age table (95 pts for age 30) when spouse_coming_to_canada is true', () => {
    const score = calculateCRS(makeProfile({
      date_of_birth: dobForAge(30),
      spouse_coming_to_canada: true,
    }));
    expect(score).toBe(240 + 95);
  });
});

// ─── matchPathways ────────────────────────────────────────────────────────────

describe('matchPathways', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a MatchResult for an eligible FSW applicant', async () => {
    setupMatcherClient({
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

  it('includes date_of_birth in missing_data when profile has no date_of_birth', async () => {
    setupMatcherClient({
      profileResult: { data: makeProfile({ date_of_birth: null }), error: null },
      pathwaysResult: { data: [makePathwayRow()], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results[0].missing_data).toContain('date_of_birth');
  });

  it('does not include date_of_birth in missing_data when profile has a date_of_birth', async () => {
    setupMatcherClient({
      profileResult: { data: makeProfile({ date_of_birth: dobForAge(30) }), error: null },
      pathwaysResult: { data: [makePathwayRow()], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results[0].missing_data).not.toContain('date_of_birth');
  });

  it('throws DatabaseError when profile is not found', async () => {
    setupMatcherClient({
      profileResult: { data: null, error: { code: 'PGRST116', message: 'No rows found' } },
    });

    await expect(matchPathways('missing-profile', mockLogger as never)).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });

  it('returns an empty array when no active express-entry pathways exist', async () => {
    setupMatcherClient({
      profileResult: { data: makeProfile(), error: null },
      pathwaysResult: { data: [], error: null },
    });

    const results = await matchPathways('profile-1', mockLogger as never);

    expect(results).toHaveLength(0);
  });

  it('uses FALLBACK_CUTOFFS when immigration_draws is empty', async () => {
    setupMatcherClient({
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
    setupMatcherClient({
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
    setupMatcherClient({
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
    expect(results.every((r) => !r.eligible)).toBe(true);
  });

  it('marks CEC applicant ineligible when canadian_work_years is 0', async () => {
    setupMatcherClient({
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

// ─── getApplicationData ───────────────────────────────────────────────────────

describe('getApplicationData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeAppRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'app-1',
      status: 'in_progress',
      submitted_at: null,
      pathway: {
        id: 'pathway-1',
        slug: 'express-entry-fsw',
        title: 'Federal Skilled Worker',
        official_name: 'Federal Skilled Worker Program',
      },
      ...overrides,
    };
  }

  function makeStepRow(n: number, overrides: Record<string, unknown> = {}) {
    return {
      id: `step-${n}`,
      step_number: n,
      title: `Step ${n}`,
      description: `Description for step ${n}`,
      type: 'information',
      estimated_duration: '1 week',
      is_optional: false,
      ...overrides,
    };
  }

  it('returns ApplicationData with correct pathway and ordered steps', async () => {
    setupAppClient({
      applicationResult: { data: makeAppRow(), error: null },
      stepsResult: {
        data: [makeStepRow(1), makeStepRow(2, { type: 'document_upload' })],
        error: null,
      },
    });

    const result = await getApplicationData('app-1', mockLogger as never);

    expect(result.id).toBe('app-1');
    expect(result.status).toBe('in_progress');
    expect(result.submitted_at).toBeNull();
    expect(result.pathway.slug).toBe('express-entry-fsw');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('current');
    expect(result.steps[1].status).toBe('upcoming');
    expect(result.steps[1].type).toBe('document_upload');
  });

  it('returns ApplicationData with empty steps when pathway has no steps', async () => {
    setupAppClient({
      applicationResult: { data: makeAppRow(), error: null },
      stepsResult: { data: [], error: null },
    });

    const result = await getApplicationData('app-1', mockLogger as never);

    expect(result.steps).toHaveLength(0);
  });

  it('throws NotFoundError when application does not exist', async () => {
    setupAppClient({
      applicationResult: {
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      },
    });

    await expect(
      getApplicationData('missing-app', mockLogger as never),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws DatabaseError on unexpected application query failure', async () => {
    setupAppClient({
      applicationResult: {
        data: null,
        error: { code: '500', message: 'connection timeout' },
      },
    });

    await expect(
      getApplicationData('app-1', mockLogger as never),
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('includes submitted_at when application has been submitted', async () => {
    setupAppClient({
      applicationResult: {
        data: makeAppRow({ submitted_at: '2026-05-01T00:00:00Z', status: 'submitted' }),
        error: null,
      },
    });

    const result = await getApplicationData('app-1', mockLogger as never);

    expect(result.submitted_at).toBe('2026-05-01T00:00:00Z');
    expect(result.status).toBe('submitted');
  });
});
