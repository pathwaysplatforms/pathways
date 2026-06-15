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
import { getDashboardData } from '../service';

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
}

function setupClient(setup: MockSetup) {
  const {
    profileResult,
    applicationResult,
    stepsResult = { data: [], error: null },
    docsResult = { data: [], error: null },
    pathwaysResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain(profileResult);
    if (table === 'applications') return makeChain(applicationResult);
    if (table === 'pathway_steps') return makeChain(stepsResult);
    if (table === 'application_documents') return makeChain(docsResult);
    if (table === 'pathways') return makeChain(pathwaysResult);
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
});
