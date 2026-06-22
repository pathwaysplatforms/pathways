import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockStorageUpload    = vi.hoisted(() => vi.fn());
const mockStorageRemove    = vi.hoisted(() => vi.fn());
const mockStorageSignedUrl = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        createSignedUrl: mockStorageSignedUrl,
      })),
    },
  })),
}));

vi.mock('@/lib/logger', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import {
  listVaultFiles,
  uploadVaultFile,
  updateVaultFileType,
  updateVaultDisplayName,
  deleteVaultFile,
  getVaultSignedUrl,
  getSatisfiedDocTypes,
} from '../service';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Mock DB builder ───────────────────────────────────────────────────────────
// Returns a top-level wrapper with .from() that points to an inner chain.
// Tests mutate db.data / db.error / db.count / db.single from the outside;
// the getter/setter proxies push those mutations into the chain automatically.

function makeDb() {
  const chain: Record<string, unknown> = {
    data: null,
    error: null,
    count: null,
    single: vi.fn(),
    then: (onFulfilled?: ((v: unknown) => unknown) | null) =>
      Promise.resolve({
        data: chain['data'],
        error: chain['error'],
        count: chain['count'],
      }).then(onFulfilled ?? undefined),
  };

  for (const method of ['select', 'eq', 'not', 'order', 'insert', 'update', 'delete']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  return {
    from: vi.fn().mockReturnValue(chain),
    get data()  { return chain['data']; },
    set data(v) { chain['data'] = v; },
    get error()  { return chain['error']; },
    set error(v) { chain['error'] = v; },
    get count()  { return chain['count']; },
    set count(v) { chain['count'] = v as number | null; },
    get single() { return chain['single'] as ReturnType<typeof vi.fn>; },
  };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const profileId = 'profile-uuid-1234';
const fileId    = 'file-uuid-5678';

const sampleRow = {
  id: fileId,
  user_id: profileId,
  storage_path: `${profileId}/uuid-test.pdf`,
  file_name: 'test.pdf',
  display_name: null as string | null,
  file_size: 12345,
  mime_type: 'application/pdf',
  document_type: 'passport',
  uploaded_at: '2026-06-21T00:00:00Z',
};

const sampleFile = {
  name: 'test.pdf',
  size: 1024,
  type: 'application/pdf',
  buffer: new ArrayBuffer(1024),
};

// ── listVaultFiles ────────────────────────────────────────────────────────────

describe('listVaultFiles', () => {
  it('returns mapped VaultFile array on success', async () => {
    const db = makeDb();
    db.data = [sampleRow];

    const result = await listVaultFiles(profileId, db as unknown as SupabaseClient, mockLogger as never);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: fileId,
      userId: profileId,
      fileName: 'test.pdf',
      displayName: null,
      documentType: 'passport',
    });
  });

  it('returns empty array when user has no files', async () => {
    const db = makeDb();
    db.data = [];

    const result = await listVaultFiles(profileId, db as unknown as SupabaseClient, mockLogger as never);
    expect(result).toEqual([]);
  });

  it('throws DatabaseError on query failure', async () => {
    const db = makeDb();
    db.data = null;
    db.error = { message: 'connection error' };

    await expect(
      listVaultFiles(profileId, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});

// ── uploadVaultFile ───────────────────────────────────────────────────────────

describe('uploadVaultFile', () => {
  beforeEach(() => {
    mockStorageUpload.mockReset();
    mockStorageRemove.mockReset();
    vi.clearAllMocks();
  });

  it('uploads file and returns new VaultFile on success', async () => {
    mockStorageUpload.mockResolvedValue({ data: { path: 'some/path' }, error: null });

    const db = makeDb();
    db.count = 0;
    db.error = null;
    db.single.mockResolvedValue({ data: sampleRow, error: null });

    const result = await uploadVaultFile(profileId, sampleFile, 'passport', db as unknown as SupabaseClient, mockLogger as never);

    expect(result.fileName).toBe('test.pdf');
    expect(result.documentType).toBe('passport');
    expect(mockStorageUpload).toHaveBeenCalledOnce();
  });

  it('throws ValidationError for disallowed MIME type', async () => {
    const db = makeDb();

    await expect(
      uploadVaultFile(profileId, { ...sampleFile, type: 'text/plain' }, null, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('throws ValidationError when file exceeds 10 MB', async () => {
    const db = makeDb();

    await expect(
      uploadVaultFile(profileId, { ...sampleFile, size: 11 * 1024 * 1024 }, null, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when 20-file limit is reached', async () => {
    const db = makeDb();
    db.count = 20;
    db.error = null;

    await expect(
      uploadVaultFile(profileId, sampleFile, null, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('rolls back storage upload when DB insert fails', async () => {
    mockStorageUpload.mockResolvedValue({ data: { path: 'some/path' }, error: null });
    mockStorageRemove.mockResolvedValue({ data: null, error: null });

    const db = makeDb();
    db.count = 0;
    db.error = null;
    db.single.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    await expect(
      uploadVaultFile(profileId, sampleFile, null, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);

    expect(mockStorageRemove).toHaveBeenCalledOnce();
  });
});

// ── updateVaultFileType ───────────────────────────────────────────────────────

describe('updateVaultFileType', () => {
  it('updates document_type and returns updated VaultFile', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: { ...sampleRow, document_type: 'bank_statement' }, error: null });

    const result = await updateVaultFileType(fileId, profileId, 'bank_statement', db as unknown as SupabaseClient, mockLogger as never);
    expect(result.documentType).toBe('bank_statement');
  });

  it('clears document_type when null is passed', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: { ...sampleRow, document_type: null }, error: null });

    const result = await updateVaultFileType(fileId, profileId, null, db as unknown as SupabaseClient, mockLogger as never);
    expect(result.documentType).toBeNull();
  });

  it('throws NotFoundError when file does not belong to user', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    await expect(
      updateVaultFileType(fileId, profileId, 'passport', db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── updateVaultDisplayName ────────────────────────────────────────────────────

describe('updateVaultDisplayName', () => {
  it('sets display_name and returns updated VaultFile', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: { ...sampleRow, display_name: 'My Passport' }, error: null });

    const result = await updateVaultDisplayName(fileId, profileId, 'My Passport', db as unknown as SupabaseClient, mockLogger as never);
    expect(result.displayName).toBe('My Passport');
  });

  it('clears display_name when null is passed', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: { ...sampleRow, display_name: null }, error: null });

    const result = await updateVaultDisplayName(fileId, profileId, null, db as unknown as SupabaseClient, mockLogger as never);
    expect(result.displayName).toBeNull();
  });

  it('throws NotFoundError when file does not belong to user', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    await expect(
      updateVaultDisplayName(fileId, profileId, 'Anything', db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── deleteVaultFile ───────────────────────────────────────────────────────────

describe('deleteVaultFile', () => {
  beforeEach(() => {
    mockStorageRemove.mockReset();
    vi.clearAllMocks();
  });

  it('deletes storage object and DB row on success', async () => {
    mockStorageRemove.mockResolvedValue({ data: null, error: null });

    const db = makeDb();
    db.data = null;
    db.error = null;
    db.single.mockResolvedValue({ data: { storage_path: `${profileId}/uuid-test.pdf` }, error: null });

    await deleteVaultFile(fileId, profileId, db as unknown as SupabaseClient, mockLogger as never);

    expect(mockStorageRemove).toHaveBeenCalledOnce();
  });

  it('logs a warning but still completes when Storage removal fails', async () => {
    mockStorageRemove.mockResolvedValue({ data: null, error: { message: 'storage error' } });

    const db = makeDb();
    db.data = null;
    db.error = null;
    db.single.mockResolvedValue({ data: { storage_path: `${profileId}/uuid-test.pdf` }, error: null });

    await deleteVaultFile(fileId, profileId, db as unknown as SupabaseClient, mockLogger as never);

    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('throws NotFoundError when file does not exist for user', async () => {
    const db = makeDb();
    db.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    await expect(
      deleteVaultFile(fileId, profileId, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(mockStorageRemove).not.toHaveBeenCalled();
  });
});

// ── getVaultSignedUrl ─────────────────────────────────────────────────────────

describe('getVaultSignedUrl', () => {
  beforeEach(() => {
    mockStorageSignedUrl.mockReset();
  });

  it('returns signed URL on success', async () => {
    mockStorageSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/signed?token=abc' },
      error: null,
    });
    const url = await getVaultSignedUrl(`${profileId}/uuid-file.pdf`, mockLogger as never);
    expect(url).toContain('signed');
  });

  it('throws DatabaseError when storage returns an error', async () => {
    mockStorageSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } });
    await expect(
      getVaultSignedUrl(`${profileId}/missing.pdf`, mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('throws DatabaseError when signedUrl is absent in response', async () => {
    mockStorageSignedUrl.mockResolvedValue({ data: { signedUrl: null }, error: null });
    await expect(
      getVaultSignedUrl(`${profileId}/broken.pdf`, mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});

// ── getSatisfiedDocTypes ──────────────────────────────────────────────────────

describe('getSatisfiedDocTypes', () => {
  it('returns a Set of all uploaded document_type values', async () => {
    const db = makeDb();
    db.data = [{ document_type: 'passport' }, { document_type: 'bank_statement' }];

    const result = await getSatisfiedDocTypes(profileId, db as unknown as SupabaseClient, mockLogger as never);

    expect(result).toBeInstanceOf(Set);
    expect(result.has('passport')).toBe(true);
    expect(result.has('bank_statement')).toBe(true);
  });

  it('returns empty Set when user has no labeled documents', async () => {
    const db = makeDb();
    db.data = [];

    const result = await getSatisfiedDocTypes(profileId, db as unknown as SupabaseClient, mockLogger as never);
    expect(result.size).toBe(0);
  });

  it('throws DatabaseError on query failure', async () => {
    const db = makeDb();
    db.data = null;
    db.error = { message: 'query error' };

    await expect(
      getSatisfiedDocTypes(profileId, db as unknown as SupabaseClient, mockLogger as never)
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
