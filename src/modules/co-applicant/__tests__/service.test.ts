import { describe, it, expect, vi } from 'vitest';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createCoApplicantProfile, listAccessibleProfiles } from '../service';

const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as import('pino').Logger;

type QueryResult = { data: unknown; error: null | Record<string, unknown> };

function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {
    then: (resolve: (v: QueryResult) => void) => resolve(result),
  };
  for (const method of ['select', 'eq', 'insert', 'order']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

function setupClient(byTable: Record<string, QueryResult>) {
  const fromFn = vi.fn().mockImplementation((table: string) => {
    return makeChain(byTable[table] ?? { data: null, error: null });
  });
  vi.mocked(createSupabaseServerClient).mockReturnValue(
    { from: fromFn } as unknown as ReturnType<typeof createSupabaseServerClient>
  );
  return fromFn;
}

describe('createCoApplicantProfile', () => {
  it('creates a co-applicant profile owned by the caller (happy path)', async () => {
    const fromFn = setupClient({
      profiles: { data: { id: 'owner-1' }, error: null },
    });
    // First `.from('profiles')` call resolves the owner lookup; the second
    // (insert) needs its own result — override via sequential mockImplementation.
    let call = 0;
    fromFn.mockImplementation(() => {
      call += 1;
      if (call === 1) return makeChain({ data: { id: 'owner-1' }, error: null });
      return makeChain({
        data: { id: 'co-applicant-1', full_name: 'Jamie Lee', email: 'jamie@example.com', onboarding_status: 'not_started' },
        error: null,
      });
    });

    const result = await createCoApplicantProfile(
      'auth-user-1',
      { fullName: 'Jamie Lee', email: 'jamie@example.com' },
      mockLogger,
    );

    expect(result.id).toBe('co-applicant-1');
    expect(result.full_name).toBe('Jamie Lee');
    expect(result.onboarding_status).toBe('not_started');
  });

  it('rejects an invalid email (edge case)', async () => {
    setupClient({ profiles: { data: { id: 'owner-1' }, error: null } });

    await expect(
      createCoApplicantProfile('auth-user-1', { fullName: 'Jamie Lee', email: 'not-an-email' }, mockLogger)
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when the caller has no profile (error case)', async () => {
    setupClient({ profiles: { data: null, error: { message: 'no rows' } } });

    await expect(
      createCoApplicantProfile('auth-user-missing', { fullName: 'Jamie Lee', email: 'jamie@example.com' }, mockLogger)
    ).rejects.toThrow(NotFoundError);
  });
});

describe('listAccessibleProfiles', () => {
  it('marks the caller\'s own row and co-applicant rows correctly (happy path)', async () => {
    setupClient({
      profiles: {
        data: [
          { id: 'owner-1', full_name: 'Alex Owner', auth_user_id: 'auth-user-1' },
          { id: 'co-applicant-1', full_name: 'Jamie Lee', auth_user_id: null },
        ],
        error: null,
      },
    });

    const result = await listAccessibleProfiles('auth-user-1', mockLogger);

    expect(result).toEqual([
      { profileId: 'owner-1', fullName: 'Alex Owner', isOwner: true },
      { profileId: 'co-applicant-1', fullName: 'Jamie Lee', isOwner: false },
    ]);
  });

  it('returns an empty array when no profiles are accessible (edge case)', async () => {
    setupClient({ profiles: { data: [], error: null } });

    const result = await listAccessibleProfiles('auth-user-1', mockLogger);

    expect(result).toEqual([]);
  });

  it('throws DatabaseError when the query fails (error case)', async () => {
    setupClient({ profiles: { data: null, error: { message: 'connection lost' } } });

    await expect(listAccessibleProfiles('auth-user-1', mockLogger)).rejects.toThrow(DatabaseError);
  });
});
