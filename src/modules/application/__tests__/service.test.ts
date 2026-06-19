import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, DatabaseError } from '@/lib/errors';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getApplicationForLayout } from '../service';

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// ─── Mock query chain (mirrors dashboard/service.test.ts) ──────────────────────

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };
  for (const method of ['select', 'eq', 'in', 'order']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

interface MockSetup {
  profileResult: QueryResult;
  applicationResult?: QueryResult;
  pathwayResult?: QueryResult;
  stepsResult?: QueryResult;
  docsResult?: QueryResult;
  progressResult?: QueryResult;
}

function setupClient(setup: MockSetup) {
  const {
    profileResult,
    applicationResult = { data: null, error: null },
    pathwayResult = { data: null, error: null },
    stepsResult = { data: [], error: null },
    docsResult = { data: [], error: null },
    progressResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain(profileResult);
    if (table === 'applications') return makeChain(applicationResult);
    if (table === 'pathways') return makeChain(pathwayResult);
    if (table === 'pathway_steps') return makeChain(stepsResult);
    if (table === 'document_requirements') return makeChain(docsResult);
    if (table === 'pathway_progress') return makeChain(progressResult);
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>
  );
}

function makeStep(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `step-${n}`,
    step_number: n,
    title: `Step ${n}`,
    description: `Description ${n}`,
    estimated_duration: '2 weeks',
    is_optional: false,
    type: 'information',
    ...overrides,
  };
}

const PROFILE = { data: { id: 'profile-1' }, error: null };
const APPLICATION = {
  data: { id: 'app-1', profile_id: 'profile-1', pathway_id: 'pathway-1', status: 'in_progress', submitted_at: null },
  error: null,
};
const PATHWAY = {
  data: { id: 'pathway-1', slug: 'express-entry-fsw', title: 'Skilled Worker', official_name: 'FSW Program' },
  error: null,
};

describe('getApplicationForLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ──
  it('maps a real application with typed steps and a step-linked document', async () => {
    setupClient({
      profileResult: PROFILE,
      applicationResult: APPLICATION,
      pathwayResult: PATHWAY,
      stepsResult: {
        data: [
          makeStep(1, { type: 'information' }),
          makeStep(2, { type: 'document_upload' }),
        ],
        error: null,
      },
      docsResult: {
        data: [
          {
            id: 'doc-1',
            name: 'Language Test',
            description: 'IELTS results',
            document_type: 'language_test',
            validity_period: '2 years',
            validation_rules: { accepted_formats: ['PDF', 'JPG'], max_size_mb: 5 },
            step_id: 'step-2',
          },
        ],
        error: null,
      },
      progressResult: { data: [{ step_id: 'step-1', status: 'complete' }], error: null },
    });

    const result = await getApplicationForLayout('app-1', 'user-1', mockLogger as never);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('app-1');
    expect(result!.pathway.slug).toBe('express-entry-fsw');
    expect(result!.steps).toHaveLength(2);
    // step-1 completed (from progress); step-2 becomes current
    expect(result!.steps[0].status).toBe('completed');
    expect(result!.steps[1].status).toBe('current');
    // document attached only to the document_upload step
    expect(result!.steps[0].document).toBeUndefined();
    expect(result!.steps[1].type).toBe('document_upload');
    expect(result!.steps[1].document).toEqual({
      name: 'Language Test',
      description: 'IELTS results',
      document_type: 'language_test',
      validity_period: '2 years',
      accepted_formats: ['PDF', 'JPG'],
      max_size_mb: 5,
    });
  });

  // ── Edge: unknown step type defaults, missing validation_rules defaults ──
  it('defaults unknown step types to information and supplies document fallbacks', async () => {
    setupClient({
      profileResult: PROFILE,
      applicationResult: APPLICATION,
      pathwayResult: PATHWAY,
      stepsResult: {
        data: [makeStep(1, { type: 'totally_invalid' }), makeStep(2, { type: 'document_upload' })],
        error: null,
      },
      docsResult: {
        data: [
          {
            id: 'doc-1',
            name: 'ECA Report',
            description: 'WES assessment',
            document_type: 'eca_report',
            validity_period: null,
            validation_rules: null,
            step_id: 'step-2',
          },
        ],
        error: null,
      },
    });

    const result = await getApplicationForLayout('app-1', 'user-1', mockLogger as never);

    expect(result!.steps[0].type).toBe('information');
    expect(result!.steps[1].document).toEqual({
      name: 'ECA Report',
      description: 'WES assessment',
      document_type: 'eca_report',
      validity_period: null,
      accepted_formats: ['PDF'],
      max_size_mb: 10,
    });
  });

  // ── Edge: application not found / not owned returns null ──
  it('returns null when the application is missing or not owned by the user', async () => {
    setupClient({
      profileResult: PROFILE,
      applicationResult: { data: null, error: null },
    });

    const result = await getApplicationForLayout('app-1', 'user-1', mockLogger as never);
    expect(result).toBeNull();
  });

  // ── Error: profile missing throws NotFoundError ──
  it('throws NotFoundError when the profile does not exist', async () => {
    setupClient({
      profileResult: { data: null, error: { code: 'PGRST116', message: 'No rows' } },
    });

    await expect(
      getApplicationForLayout('app-1', 'user-1', mockLogger as never)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── Error: application query failure throws DatabaseError ──
  it('throws DatabaseError when the application query fails', async () => {
    setupClient({
      profileResult: PROFILE,
      applicationResult: { data: null, error: { message: 'boom' } },
    });

    await expect(
      getApplicationForLayout('app-1', 'user-1', mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
