import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseError } from '@/lib/errors';

vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { syncSubscription, getSubscriptionForUser, ACTIVE_STATUSES } from '../service';

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// Minimal Stripe.Subscription stub — period fields live on items.data[0] in v22
function makeSubscription(overrides: Partial<{
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  itemPeriodStart: number;
  itemPeriodEnd: number;
  items: { data: Array<{ price: { id: string }; current_period_start: number; current_period_end: number }> };
}> = {}) {
  const { itemPeriodStart = 1700000000, itemPeriodEnd = 1731600000, ...rest } = overrides;
  return {
    id: 'sub_test123',
    status: 'active',
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_test' }, current_period_start: itemPeriodStart, current_period_end: itemPeriodEnd }] },
    ...rest,
  } as unknown as import('stripe').default.Subscription;
}

function makeAdmin(
  upsertResult: { error: null | { message: string } } = { error: null },
  updateResult: { error: null | { message: string } } = { error: null },
  selectResult: { data: null | Record<string, unknown>; error: null | { message: string } } = { data: null, error: null },
) {
  const upsert = vi.fn().mockResolvedValue(upsertResult);
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(updateResult) });
  const maybeSingle = vi.fn().mockResolvedValue(selectResult);
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  return {
    from: vi.fn((table: string) => {
      if (table === 'subscriptions') return { upsert, select };
      if (table === 'profiles') return { update };
      return {};
    }),
    _upsert: upsert,
    _update: update,
    _maybeSingle: maybeSingle,
  };
}

// ── syncSubscription ───────────────────────────────────────────────────────────

describe('syncSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts subscription row and sets profile to paid for active status', async () => {
    const admin = makeAdmin();
    await syncSubscription(admin as never, 'user-1', 'cus_123', makeSubscription({ status: 'active' }), mockLog as never);
    expect(admin._upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', status: 'active' }),
      { onConflict: 'user_id' },
    );
    expect(admin._update).toHaveBeenCalledWith({ subscription_status: 'paid' });
  });

  it('sets profile to paid for trialing status', async () => {
    const admin = makeAdmin();
    await syncSubscription(admin as never, 'user-2', 'cus_456', makeSubscription({ status: 'trialing' }), mockLog as never);
    expect(admin._update).toHaveBeenCalledWith({ subscription_status: 'paid' });
  });

  it('sets profile to free for canceled status', async () => {
    const admin = makeAdmin();
    await syncSubscription(admin as never, 'user-3', 'cus_789', makeSubscription({ status: 'canceled' }), mockLog as never);
    expect(admin._update).toHaveBeenCalledWith({ subscription_status: 'free' });
  });

  it('throws DatabaseError when subscription upsert fails', async () => {
    const admin = makeAdmin({ error: { message: 'db error' } });
    await expect(
      syncSubscription(admin as never, 'user-4', 'cus_000', makeSubscription(), mockLog as never),
    ).rejects.toThrow(DatabaseError);
  });

  it('throws DatabaseError when profile update fails', async () => {
    const updateFail = { error: { message: 'profile update failed' } };
    const upsertOk = { error: null };
    const admin = makeAdmin(upsertOk, updateFail);
    await expect(
      syncSubscription(admin as never, 'user-5', 'cus_111', makeSubscription(), mockLog as never),
    ).rejects.toThrow(DatabaseError);
  });

  it('converts unix timestamps to ISO strings', async () => {
    const admin = makeAdmin();
    await syncSubscription(
      admin as never, 'user-6', 'cus_222',
      makeSubscription({ itemPeriodStart: 1700000000, itemPeriodEnd: 1731600000 }),
      mockLog as never,
    );
    expect(admin._upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        current_period_start: new Date(1700000000 * 1000).toISOString(),
        current_period_end: new Date(1731600000 * 1000).toISOString(),
      }),
      expect.anything(),
    );
  });
});

// ── getSubscriptionForUser ─────────────────────────────────────────────────────

describe('getSubscriptionForUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns subscription row when found', async () => {
    const row = { id: 'row-1', user_id: 'user-1', status: 'active' } satisfies Record<string, unknown>;
    const admin = makeAdmin(undefined, undefined, { data: row, error: null });
    const result = await getSubscriptionForUser(admin as never, 'user-1', mockLog as never);
    expect(result).toEqual(row);
  });

  it('returns null when no subscription exists', async () => {
    const admin = makeAdmin(undefined, undefined, { data: null, error: null });
    const result = await getSubscriptionForUser(admin as never, 'user-1', mockLog as never);
    expect(result).toBeNull();
  });

  it('throws DatabaseError on query failure', async () => {
    const admin = makeAdmin(undefined, undefined, { data: null, error: { message: 'fail' } });
    await expect(
      getSubscriptionForUser(admin as never, 'user-1', mockLog as never),
    ).rejects.toThrow(DatabaseError);
  });
});

// ── ACTIVE_STATUSES ────────────────────────────────────────────────────────────

describe('ACTIVE_STATUSES', () => {
  it('includes active and trialing', () => {
    expect(ACTIVE_STATUSES.has('active')).toBe(true);
    expect(ACTIVE_STATUSES.has('trialing')).toBe(true);
  });

  it('excludes canceled, past_due, incomplete', () => {
    for (const s of ['canceled', 'past_due', 'incomplete', 'unpaid']) {
      expect(ACTIVE_STATUSES.has(s)).toBe(false);
    }
  });
});
