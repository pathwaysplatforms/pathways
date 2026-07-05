import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError, DatabaseError } from '@/lib/errors';
import { computeProfileCompletenessPct } from '@/lib/completeness';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateProfileFields, recalculateCrsEstimate } from '@/app/actions/profile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

/** Thenable query chain covering update().eq().select().single() and select().eq().single(). */
function makeChain(result: QueryResult) {
  const chain = {
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };
  chain.update.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

/** Wires the mocked server client: auth user + a queue of per-from() chains. */
function setupClient(chains: ReturnType<typeof makeChain>[]) {
  let call = 0;
  const fromFn = vi.fn().mockImplementation(() => {
    const chain = chains[Math.min(call, chains.length - 1)];
    call += 1;
    return chain;
  });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: fromFn,
  } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return fromFn;
}

/** Merged row returned by the update().select() round trip (12 of 19 fields set). */
const MERGED_ROW = {
  full_name: 'Jane Smith',
  date_of_birth: '1992-03-10',
  nationality: 'Indian',
  current_country: 'India',
  marital_status: 'single',
  occupation: 'Software Engineer',
  noc_teer_category: 1,
  years_experience: 6,
  canadian_work_years: null,
  foreign_work_years: 6,
  education_level: 'bachelors',
  eca_obtained: null,
  clb_speaking: 9,
  clb_listening: 9,
  clb_reading: null,
  clb_writing: null,
  intended_province: null,
  has_provincial_nomination: null,
  has_canadian_job_offer: null,
};

// ─── updateProfileFields ─────────────────────────────────────────────────────

describe('updateProfileFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates fields then persists the recomputed completeness pct', async () => {
    const updateChain = makeChain({ data: MERGED_ROW, error: null });
    const pctChain = makeChain({ data: null, error: null });
    setupClient([updateChain, pctChain]);

    await updateProfileFields({ occupation: 'Software Engineer' });

    expect(updateChain.update).toHaveBeenCalledWith({ occupation: 'Software Engineer' });
    expect(pctChain.update).toHaveBeenCalledWith({
      profile_completeness_pct: computeProfileCompletenessPct(MERGED_ROW),
    });
  });

  it('throws ValidationError for out-of-range input without touching the database', async () => {
    const fromFn = setupClient([makeChain({ data: null, error: null })]);

    await expect(updateProfileFields({ years_experience: -5 })).rejects.toBeInstanceOf(ValidationError);
    expect(fromFn).not.toHaveBeenCalled();
  });

  it('returns early with no writes when every field is undefined', async () => {
    const fromFn = setupClient([makeChain({ data: null, error: null })]);

    await updateProfileFields({});

    expect(fromFn).not.toHaveBeenCalled();
  });

  it('throws DatabaseError and skips the pct write when the update fails', async () => {
    const failingChain = makeChain({ data: null, error: { message: 'boom' } });
    const pctChain = makeChain({ data: null, error: null });
    setupClient([failingChain, pctChain]);

    await expect(updateProfileFields({ occupation: 'Engineer' })).rejects.toBeInstanceOf(DatabaseError);
    expect(pctChain.update).not.toHaveBeenCalled();
  });
});

// ─── recalculateCrsEstimate ──────────────────────────────────────────────────

describe('recalculateCrsEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes an estimate from profile columns and persists it into pathway_input_json', async () => {
    const fetchChain = makeChain({
      data: {
        ...MERGED_ROW,
        language_proficiency_self: null,
        foreign_work_recent: true,
        noc_code: null,
        has_sibling_in_canada: null,
        spouse_coming_to_canada: null,
        spouse_clb_speaking: null,
        spouse_clb_listening: null,
        spouse_clb_reading: null,
        spouse_clb_writing: null,
        spouse_canadian_work_years: null,
        pathway_input_json: { existing: true },
      },
      error: null,
    });
    const writeChain = makeChain({ data: null, error: null });
    setupClient([fetchChain, writeChain]);

    const estimate = await recalculateCrsEstimate();

    expect(estimate).not.toBeNull();
    expect(estimate?.breakdown.education).toBe(120);
    expect(writeChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pathway_input_json: expect.objectContaining({ existing: true, crs_estimate: estimate }),
      })
    );
  });

  it('returns null without writing when the profile is too sparse to estimate', async () => {
    const sparse = Object.fromEntries(Object.keys(MERGED_ROW).map((k) => [k, null]));
    const fetchChain = makeChain({ data: { ...sparse, pathway_input_json: null }, error: null });
    const writeChain = makeChain({ data: null, error: null });
    setupClient([fetchChain, writeChain]);

    const estimate = await recalculateCrsEstimate();

    expect(estimate).toBeNull();
    expect(writeChain.update).not.toHaveBeenCalled();
  });

  it('throws DatabaseError when the profile fetch fails', async () => {
    setupClient([makeChain({ data: null, error: { message: 'boom' } })]);

    await expect(recalculateCrsEstimate()).rejects.toBeInstanceOf(DatabaseError);
  });
});
