import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseError } from '@/lib/errors';

vi.mock('@/lib/supabase/admin');
vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAccountData, buildUserExport } from '../service';

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockAuthUser = {
  id: 'user-1',
  email: 'test@example.com',
  last_sign_in_at: '2026-06-01T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

const mockProfile = {
  id: 'profile-1',
  auth_user_id: 'user-1',
  full_name: 'Jane Smith',
  nationality: 'Indian',
  current_country: 'India',
  date_of_birth: '1990-01-01',
  marital_status: 'single',
  occupation: 'Software Engineer',
  years_experience: 3,
  education_level: 'bachelors',
  created_at: '2026-01-01T00:00:00Z',
};

function makeAdminClient(getUserResult: { data: { user: unknown } | { user: null }; error: unknown }) {
  const adminAuthMock = {
    getUserById: vi.fn().mockResolvedValue(getUserResult),
  };

  const chainFn = (data: unknown, error: unknown = null) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data, error }),
  });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') return chainFn(mockProfile);
    if (table === 'applications') return { ...chainFn([]), select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    return chainFn(null);
  });

  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    auth: { admin: adminAuthMock },
    from: fromFn,
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

// ─── getAccountData ───────────────────────────────────────────────────────────

describe('getAccountData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns account data for a valid user', async () => {
    makeAdminClient({ data: { user: mockAuthUser }, error: null });

    const result = await getAccountData('user-1', mockLogger as never);

    expect(result.email).toBe('test@example.com');
    expect(result.lastSignInAt).toBe('2026-06-01T10:00:00Z');
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z');
  });

  it('returns null lastSignInAt when field is missing', async () => {
    makeAdminClient({
      data: { user: { ...mockAuthUser, last_sign_in_at: undefined } },
      error: null,
    });

    const result = await getAccountData('user-1', mockLogger as never);
    expect(result.lastSignInAt).toBeNull();
  });

  it('returns empty string email when user has no email', async () => {
    makeAdminClient({
      data: { user: { ...mockAuthUser, email: undefined } },
      error: null,
    });

    const result = await getAccountData('user-1', mockLogger as never);
    expect(result.email).toBe('');
  });

  it('throws DatabaseError when admin API returns an error', async () => {
    makeAdminClient({ data: { user: null }, error: { message: 'User not found' } });

    await expect(getAccountData('user-1', mockLogger as never)).rejects.toThrow(DatabaseError);
  });

  it('throws DatabaseError when user object is null', async () => {
    makeAdminClient({ data: { user: null }, error: null });

    await expect(getAccountData('user-1', mockLogger as never)).rejects.toThrow(DatabaseError);
  });
});

// ─── buildUserExport ──────────────────────────────────────────────────────────

describe('buildUserExport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns export data with profile and empty applications', async () => {
    const adminAuthMock = {
      getUserById: vi.fn().mockResolvedValue({ data: { user: mockAuthUser }, error: null }),
    };

    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    };
    const appsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      auth: { admin: adminAuthMock },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return profileChain;
        if (table === 'applications') return appsChain;
        return profileChain;
      }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const result = await buildUserExport('user-1', mockLogger as never);

    expect(result.profile.fullName).toBe('Jane Smith');
    expect(result.profile.email).toBe('test@example.com');
    expect(result.applications).toHaveLength(0);
    expect(result.exportedAt).toBeTruthy();
  });

  it('throws DatabaseError when auth user fetch fails', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'fail' } }) } },
      from: vi.fn(),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    await expect(buildUserExport('user-1', mockLogger as never)).rejects.toThrow(DatabaseError);
  });

  it('throws DatabaseError when profile fetch fails', async () => {
    const adminAuthMock = {
      getUserById: vi.fn().mockResolvedValue({ data: { user: mockAuthUser }, error: null }),
    };

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      auth: { admin: adminAuthMock },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: '42P01', message: 'DB error' } }),
      }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    await expect(buildUserExport('user-1', mockLogger as never)).rejects.toThrow(DatabaseError);
  });
});
