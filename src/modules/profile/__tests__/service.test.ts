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
import { getProfileTabData, buildAvatarInitials, buildFirstName } from '../service';

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    auth_user_id: 'user-1',
    full_name: 'Jane Smith',
    nationality: 'Indian',
    current_country: 'India',
    date_of_birth: '1990-01-01',
    marital_status: 'single',
    occupation: 'Software Engineer',
    noc_code: '21232',
    noc_teer_category: 1,
    years_experience: 3,
    has_canadian_experience: false,
    education_level: "bachelor",
    education_level_voice: "bachelor's degree",
    degree_level: "bachelor",
    degree_field: 'Computer Science',
    eca_obtained: false,
    clb_listening: 9,
    clb_reading: 9,
    clb_speaking: 8,
    clb_writing: 8,
    english_level: 'advanced',
    annual_income: 80000,
    income_currency: 'USD',
    intended_province: 'Ontario',
    has_family_in_canada: false,
    has_provincial_nomination: false,
    profile_completeness_pct: 80,
    ...overrides,
  };
}

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

function makeChain(result: QueryResult) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function setupClient(profileResult: QueryResult, appResult: QueryResult) {
  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return makeChain(profileResult);
    if (table === 'applications') return makeChain(appResult);
    return makeChain({ data: null, error: null });
  });
  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>
  );
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

describe('buildAvatarInitials', () => {
  it('returns two-char initials for a full name', () => {
    expect(buildAvatarInitials('Jane Smith')).toBe('JS');
  });

  it('returns single uppercase char for a single name', () => {
    expect(buildAvatarInitials('Madonna')).toBe('M');
  });

  it('returns ? for null', () => {
    expect(buildAvatarInitials(null)).toBe('?');
  });

  it('uses first and last word for multi-word names', () => {
    expect(buildAvatarInitials('Jean Claude Van Damme')).toBe('JD');
  });
});

describe('buildFirstName', () => {
  it('extracts the first name from a full name', () => {
    expect(buildFirstName('Jane Smith')).toBe('Jane');
  });

  it('returns there for null', () => {
    expect(buildFirstName(null)).toBe('there');
  });

  it('returns the only word as the first name', () => {
    expect(buildFirstName('Madonna')).toBe('Madonna');
  });
});

// ─── Service ─────────────────────────────────────────────────────────────────

describe('getProfileTabData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full profile data for a complete profile with application', async () => {
    setupClient(
      { data: makeProfile(), error: null },
      { data: { id: 'app-1' }, error: null }
    );
    const result = await getProfileTabData('user-1', mockLogger as never);

    expect(result.fullName).toBe('Jane Smith');
    expect(result.nationality).toBe('Indian');
    expect(result.avatarInitials).toBe('JS');
    expect(result.firstName).toBe('Jane');
    expect(result.applicationId).toBe('app-1');
    expect(result.clbListening).toBe(9);
    expect(result.clbWriting).toBe(8);
    expect(result.profileCompletenessPct).toBe(80);
  });

  it('returns null for optional fields that are missing', async () => {
    setupClient(
      { data: makeProfile({ nationality: null, clb_listening: null, eca_obtained: null, years_experience: null }), error: null },
      { data: null, error: null }
    );
    const result = await getProfileTabData('user-1', mockLogger as never);

    expect(result.nationality).toBeNull();
    expect(result.clbListening).toBeNull();
    expect(result.ecaObtained).toBeNull();
    expect(result.yearsExperience).toBeNull();
    expect(result.applicationId).toBeNull();
  });

  it('prefers education_level_voice over education_level', async () => {
    setupClient(
      { data: makeProfile({ education_level: 'bachelors', education_level_voice: "bachelor's degree" }), error: null },
      { data: null, error: null }
    );
    const result = await getProfileTabData('user-1', mockLogger as never);
    expect(result.educationLevel).toBe("bachelor's degree");
  });

  it('falls back to education_level when voice field is null', async () => {
    setupClient(
      { data: makeProfile({ education_level: 'bachelors', education_level_voice: null }), error: null },
      { data: null, error: null }
    );
    const result = await getProfileTabData('user-1', mockLogger as never);
    expect(result.educationLevel).toBe('bachelors');
  });

  it('returns null educationLevel when both fields are null', async () => {
    setupClient(
      { data: makeProfile({ education_level: null, education_level_voice: null }), error: null },
      { data: null, error: null }
    );
    const result = await getProfileTabData('user-1', mockLogger as never);
    expect(result.educationLevel).toBeNull();
  });

  it('throws NotFoundError when profile does not exist (PGRST116)', async () => {
    setupClient(
      { data: null, error: { code: 'PGRST116', message: 'Not found' } },
      { data: null, error: null }
    );
    await expect(getProfileTabData('user-1', mockLogger as never)).rejects.toThrow(NotFoundError);
  });

  it('throws DatabaseError on unexpected profile query failure', async () => {
    setupClient(
      { data: null, error: { code: '42P01', message: 'relation does not exist' } },
      { data: null, error: null }
    );
    await expect(getProfileTabData('user-1', mockLogger as never)).rejects.toThrow(DatabaseError);
  });

  it('throws DatabaseError when application query fails', async () => {
    setupClient(
      { data: makeProfile(), error: null },
      { data: null, error: { code: '42P01', message: 'DB error' } }
    );
    await expect(getProfileTabData('user-1', mockLogger as never)).rejects.toThrow(DatabaseError);
  });

  it('builds correct avatar initials for a single-word name', async () => {
    setupClient(
      { data: makeProfile({ full_name: 'Madonna' }), error: null },
      { data: null, error: null }
    );
    const result = await getProfileTabData('user-1', mockLogger as never);
    expect(result.avatarInitials).toBe('M');
    expect(result.firstName).toBe('Madonna');
  });
});
