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
import { getApplicationForLayout, getApplicationData, getUserApplications } from '../service';

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// ─── Mock query chain (mirrors dashboard/service.test.ts) ──────────────────────

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };
  for (const method of ['select', 'eq', 'in', 'not', 'order']) {
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
    if (table === 'user_documents') return makeChain({ data: [], error: null });
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
    resources: null,
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

// ─── getApplicationData ────────────────────────────────────────────────────────

function makeAppDataClient(setup: {
  profileResult: QueryResult;
  pathwayResult?: QueryResult;
  stepsResult?: QueryResult;
  docsResult?: QueryResult;
  progressResult?: QueryResult;
}) {
  const {
    profileResult,
    pathwayResult = { data: null, error: null },
    stepsResult = { data: [], error: null },
    docsResult = { data: [], error: null },
    progressResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain(profileResult);
    if (table === 'pathways') return makeChain(pathwayResult);
    if (table === 'pathway_steps') return makeChain(stepsResult);
    if (table === 'document_requirements') return makeChain(docsResult);
    if (table === 'pathway_progress') return makeChain(progressResult);
    if (table === 'user_documents') return makeChain({ data: [], error: null });
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>
  );
}

const APP_DATA_PROFILE = {
  data: { id: 'prof-1', selected_pathway_slug: 'express-entry-fsw' },
  error: null,
};

const APP_DATA_PATHWAY = {
  data: {
    id: 'path-1', slug: 'express-entry-fsw', title: 'Express Entry',
    official_name: 'Federal Skilled Worker', description: 'Points-based system',
    processing_time_min: '6 months', processing_time_max: '12 months', fee_gbp: 0,
  },
  error: null,
};

describe('getApplicationData', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns full pathway data including checklist_items', async () => {
    makeAppDataClient({
      profileResult: APP_DATA_PROFILE,
      pathwayResult: APP_DATA_PATHWAY,
      stepsResult: {
        data: [{
          id: 'step-1', step_number: 1, title: 'ECA', description: 'Get credentials assessed',
          estimated_duration: '8 weeks', is_optional: false,
          resources: [{ label: 'WES', url: 'https://wes.org', type: 'official' }],
          checklist_items: ['Submit to WES', 'Pay fee'],
        }],
        error: null,
      },
      docsResult: { data: [{ id: 'doc-1', name: 'ECA Report', is_mandatory: true, document_type: 'eca_report' }], error: null },
    });

    const result = await getApplicationData('user-1', mockLogger as never);

    expect(result).not.toBeNull();
    expect(result!.pathwaySlug).toBe('express-entry-fsw');
    expect(result!.steps).toHaveLength(1);
    expect(result!.steps[0].checklistItems).toEqual([
      { label: 'Submit to WES', detail: 'Submit to WES' },
      { label: 'Pay fee', detail: 'Pay fee' },
    ]);
    expect(result!.documents).toHaveLength(1);
    expect(result!.documents[0].satisfied).toBe(false);
  });

  it('sets checklistItems to null when the DB column is empty', async () => {
    makeAppDataClient({
      profileResult: APP_DATA_PROFILE,
      pathwayResult: APP_DATA_PATHWAY,
      stepsResult: {
        data: [{
          id: 'step-1', step_number: 1, title: 'ECA', description: 'desc',
          estimated_duration: '4 weeks', is_optional: false, resources: null, checklist_items: null,
        }],
        error: null,
      },
    });

    const result = await getApplicationData('user-1', mockLogger as never);

    expect(result!.steps[0].checklistItems).toBeNull();
  });

  it('returns null when profile has no selected_pathway_slug', async () => {
    makeAppDataClient({
      profileResult: { data: { id: 'prof-1', selected_pathway_slug: null }, error: null },
    });

    const result = await getApplicationData('user-1', mockLogger as never);
    expect(result).toBeNull();
  });
});

const ACCESSIBLE_PROFILE_IDS = { data: [{ id: 'profile-1' }], error: null };

describe('getApplicationForLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ──
  it('maps a real application with typed steps and a step-linked document', async () => {
    setupClient({
      profileResult: ACCESSIBLE_PROFILE_IDS,
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
      satisfied: false,
    });
  });

  // ── Edge: unknown step type defaults, missing validation_rules defaults ──
  it('defaults unknown step types to information and supplies document fallbacks', async () => {
    setupClient({
      profileResult: ACCESSIBLE_PROFILE_IDS,
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
      satisfied: false,
    });
  });

  // ── Edge: application not found / not owned returns null ──
  it('returns null when the application is missing or not owned by the user', async () => {
    setupClient({
      profileResult: ACCESSIBLE_PROFILE_IDS,
      applicationResult: { data: null, error: null },
    });

    const result = await getApplicationForLayout('app-1', 'user-1', mockLogger as never);
    expect(result).toBeNull();
  });

  // ── Edge: application belongs to a profile outside the caller's accessible set ──
  it('returns null when the application belongs to an inaccessible profile', async () => {
    setupClient({
      profileResult: ACCESSIBLE_PROFILE_IDS,
      applicationResult: {
        data: { id: 'app-1', profile_id: 'someone-elses-profile', pathway_id: 'pathway-1', status: 'draft', submitted_at: null },
        error: null,
      },
    });

    const result = await getApplicationForLayout('app-1', 'user-1', mockLogger as never);
    expect(result).toBeNull();
  });

  // ── Error: accessible-profiles query failure throws DatabaseError ──
  it('throws DatabaseError when the accessible-profiles query fails', async () => {
    setupClient({
      profileResult: { data: null, error: { message: 'boom' } },
    });

    await expect(
      getApplicationForLayout('app-1', 'user-1', mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  // ── Error: application query failure throws DatabaseError ──
  it('throws DatabaseError when the application query fails', async () => {
    setupClient({
      profileResult: ACCESSIBLE_PROFILE_IDS,
      applicationResult: { data: null, error: { message: 'boom' } },
    });

    await expect(
      getApplicationForLayout('app-1', 'user-1', mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});

// ─── getUserApplications ────────────────────────────────────────────────────

function setupUserApplicationsClient(setup: {
  profileResult: QueryResult;
  applicationsResult?: QueryResult;
  stepsResult?: QueryResult;
  progressResult?: QueryResult;
}) {
  const {
    profileResult,
    applicationsResult = { data: [], error: null },
    stepsResult = { data: [], error: null },
    progressResult = { data: [], error: null },
  } = setup;

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain(profileResult);
    if (table === 'applications') return makeChain(applicationsResult);
    if (table === 'pathway_steps') return makeChain(stepsResult);
    if (table === 'pathway_progress') return makeChain(progressResult);
    return makeChain({ data: null, error: null });
  });

  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>
  );
}

const ACCESSIBLE_PROFILES: QueryResult = {
  data: [{ id: 'profile-1', full_name: 'Alex Owner', auth_user_id: 'user-1' }],
  error: null,
};

const ACCESSIBLE_PROFILES_WITH_CO_APPLICANT: QueryResult = {
  data: [
    { id: 'profile-1', full_name: 'Alex Owner', auth_user_id: 'user-1' },
    { id: 'profile-2', full_name: 'Jamie Lee', auth_user_id: null },
  ],
  error: null,
};

describe('getUserApplications', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── Happy path ──
  it('returns each application with its completed/total step counts', async () => {
    setupUserApplicationsClient({
      profileResult: ACCESSIBLE_PROFILES,
      applicationsResult: {
        data: [
          {
            id: 'app-1', status: 'draft', pathway_id: 'pathway-1', profile_id: 'profile-1',
            pathway: { id: 'pathway-1', slug: 'express-entry-fsw', title: 'Skilled Worker', official_name: 'FSW Program', processing_time_min: '6 months', processing_time_max: '12 months' },
          },
          {
            id: 'app-2', status: 'draft', pathway_id: 'pathway-2', profile_id: 'profile-1',
            pathway: { id: 'pathway-2', slug: 'provincial-nominee', title: 'PNP', official_name: 'Provincial Nominee Program', processing_time_min: '12 months', processing_time_max: '18 months' },
          },
        ],
        error: null,
      },
      stepsResult: {
        data: [
          { id: 'step-1', pathway_id: 'pathway-1' },
          { id: 'step-2', pathway_id: 'pathway-1' },
          { id: 'step-3', pathway_id: 'pathway-2' },
        ],
        error: null,
      },
      progressResult: {
        data: [
          { profile_id: 'profile-1', pathway_slug: 'express-entry-fsw', status: 'complete' },
          { profile_id: 'profile-1', pathway_slug: 'provincial-nominee', status: 'in_progress' },
        ],
        error: null,
      },
    });

    const result = await getUserApplications('user-1', mockLogger as never);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      applicationId: 'app-1',
      pathwaySlug: 'express-entry-fsw',
      pathwayTitle: 'Skilled Worker',
      pathwayOfficialName: 'FSW Program',
      processingTime: '6 months–12 months',
      status: 'draft',
      completedSteps: 1,
      totalSteps: 2,
      profileId: 'profile-1',
      personName: 'You',
    });
    expect(result[1].completedSteps).toBe(0);
    expect(result[1].totalSteps).toBe(1);
  });

  // ── Happy path: co-applicant's application is labeled with their name ──
  it('labels a co-applicant\'s application with their name, not "You"', async () => {
    setupUserApplicationsClient({
      profileResult: ACCESSIBLE_PROFILES_WITH_CO_APPLICANT,
      applicationsResult: {
        data: [
          {
            id: 'app-3', status: 'draft', pathway_id: 'pathway-1', profile_id: 'profile-2',
            pathway: { id: 'pathway-1', slug: 'express-entry-fsw', title: 'Skilled Worker', official_name: 'FSW Program', processing_time_min: '6 months', processing_time_max: '12 months' },
          },
        ],
        error: null,
      },
    });

    const result = await getUserApplications('user-1', mockLogger as never);

    expect(result).toHaveLength(1);
    expect(result[0].profileId).toBe('profile-2');
    expect(result[0].personName).toBe('Jamie Lee');
  });

  // ── Edge: user has no applications yet ──
  it('returns an empty array when the user has no applications', async () => {
    setupUserApplicationsClient({
      profileResult: ACCESSIBLE_PROFILES,
      applicationsResult: { data: [], error: null },
    });

    const result = await getUserApplications('user-1', mockLogger as never);
    expect(result).toEqual([]);
  });

  // ── Error: profile missing throws NotFoundError ──
  it('throws NotFoundError when the caller has no profile', async () => {
    setupUserApplicationsClient({
      profileResult: { data: [], error: null },
    });

    await expect(
      getUserApplications('user-1', mockLogger as never)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── Error: applications query failure throws DatabaseError ──
  it('throws DatabaseError when the applications query fails', async () => {
    setupUserApplicationsClient({
      profileResult: ACCESSIBLE_PROFILES,
      applicationsResult: { data: null, error: { message: 'boom' } },
    });

    await expect(
      getUserApplications('user-1', mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
