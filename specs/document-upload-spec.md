# Document Upload Spec
## Real Supabase Storage upload wired to DocumentUploadModal

---

## Context

The upload flow is currently a stub. This spec wires it end-to-end:

```
User selects file in DocumentUploadModal
  → supabase.storage.from('application-documents').upload(path, file)
  → INSERT into application_documents (storage_path, filename, mime_type, etc.)
  → completeStep() marks the step done
  → application_step_completions row written
  → page revalidated, step shown as completed in ProgressTracker
```

Everything downstream (step completion, progress tracker, page revalidation)
is already wired correctly. Only the storage upload and application_documents
write are missing.

---

## 1. Bucket Setup

### config.toml

Uncomment / add the bucket definition under `[storage.buckets]`:

```toml
[storage.buckets.application-documents]
public = false
file_size_limit = "10MiB"
allowed_mime_types = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]
```

### Migration: create bucket + RLS

Create `supabase/migrations/20260528000006_storage_documents_bucket.sql`:

```sql
-- Create the application-documents storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,  -- 10MiB in bytes
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS: users can only upload to their own application folder
create policy "users can upload own application documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] in (
      select a.id::text
      from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  );

-- RLS: users can read their own application documents
create policy "users can read own application documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] in (
      select a.id::text
      from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  );

-- RLS: users can delete their own application documents
create policy "users can delete own application documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] in (
      select a.id::text
      from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  );
```

Run this in Supabase SQL editor AND save the file locally.

---

## 2. Storage Path Convention

Every uploaded file is stored at:

```
application-documents/{applicationId}/{requirementId}/{filename}
```

- `applicationId` — UUID of the application row
- `requirementId` — UUID of the document_requirements row (from step.document.id)
- `filename` — sanitized original filename with a timestamp prefix to avoid
  collisions: `{timestamp}_{sanitized_original_name}`

Sanitize filename: replace spaces and special characters with underscores,
keep the extension.

```typescript
function buildStoragePath(
  applicationId: string,
  requirementId: string,
  originalFilename: string
): string {
  const timestamp = Date.now()
  const sanitized = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
  return `${applicationId}/${requirementId}/${timestamp}_${sanitized}`
}
```

---

## 3. New Server Action: `uploadDocument`

Add to `src/app/applications/actions.ts`:

```typescript
export async function uploadDocument(formData: FormData): Promise<{
  success: boolean
  error?: string
  documentId?: string
}>`
```

**Parameters via FormData:**
- `applicationId` — string (UUID)
- `stepId` — string (UUID)
- `requirementId` — string (UUID, from document_requirements)
- `file` — File object

**Implementation steps:**

1. Extract and validate all fields with Zod:
   - `applicationId`, `stepId`, `requirementId` — UUID format
   - `file` — must be present, size ≤ 10MB, MIME type in allowed list

2. Auth guard — same pattern as `completeStep`:
   - Get profile via `getProfile()`
   - Verify the application belongs to this profile
   - Return `{ success: false, error: 'Not found' }` if not

3. Build storage path using `buildStoragePath()`

4. Upload to Supabase Storage:
```typescript
const supabase = createSupabaseServerClient()
const { error: storageError } = await supabase.storage
  .from('application-documents')
  .upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  })
if (storageError) return { success: false, error: storageError.message }
```

5. Insert into `application_documents`:
```typescript
const { data: doc, error: dbError } = await supabase
  .from('application_documents')
  .insert({
    application_id: applicationId,
    requirement_id: requirementId,
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    status: 'uploaded',
  })
  .select('id')
  .single()
if (dbError) {
  // Attempt to clean up the orphaned storage object
  await supabase.storage
    .from('application-documents')
    .remove([storagePath])
  return { success: false, error: dbError.message }
}
```

6. Call `completeStep` internally (do not duplicate the logic — import and
   call the existing function):
```typescript
await completeStep(applicationId, stepId)
```

7. Return `{ success: true, documentId: doc.id }`

**Error handling:**
- Storage upload fails → return error, do not write DB row
- DB insert fails → delete the storage object, return error
- Both failures → log both errors, return generic error message to client
- Never expose raw Supabase error messages to the client in production —
  log them server-side and return a safe message

---

## 4. Update `DocumentUploadModal`

The modal currently uses a `useState` for the file and fires a fake
`setTimeout`. Replace the upload handler entirely.

### Props change

Add `requirementId` to the modal props (already available from
`step.document.id` in `DocumentUploadStep`):

```typescript
interface DocumentUploadModalProps {
  applicationId: string
  stepId: string
  requirementId: string        // ← add this
  document: DocumentRequirement
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}
```

### New upload handler

Replace the `setTimeout` simulation with:

```typescript
const handleUpload = async () => {
  if (!selectedFile) return
  setUploadState('uploading')

  const formData = new FormData()
  formData.append('applicationId', applicationId)
  formData.append('stepId', stepId)
  formData.append('requirementId', requirementId)
  formData.append('file', selectedFile)

  const result = await uploadDocument(formData)

  if (result.success) {
    setUploadState('success')
    setTimeout(() => {
      onSuccess()
      onOpenChange(false)
      setUploadState('idle')
      setSelectedFile(null)
    }, 2000)
  } else {
    setUploadState('error')
    setErrorMessage(result.error ?? 'Upload failed. Please try again.')
  }
}
```

### Error state

Add `errorMessage: string` to component state. Render it in the error
state UI — replace the generic "Upload failed" text with the actual message.

### File validation (client-side, before upload)

Add client-side validation when file is selected — show inline error
without attempting upload:

```typescript
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'File must be a PDF, JPG, PNG, or WebP image.'
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large. Maximum size is 10MB.`
  }
  return null
}
```

Call this in the file selection handler. If invalid, show the error inline
near the drop zone without changing `uploadState`.

---

## 5. Update `DocumentUploadStep`

Pass `requirementId` down to the modal:

```typescript
// The requirementId comes from step.document.id
// step.document is the document_requirements row joined in getApplicationData()
<DocumentUploadModal
  applicationId={applicationId}
  stepId={step.id}
  requirementId={step.document.id}   // ← add this
  document={step.document}
  open={modalOpen}
  onOpenChange={setModalOpen}
  onSuccess={handleSuccess}
/>
```

`handleSuccess` in `DocumentUploadStep` no longer needs to call `completeStep`
directly — `uploadDocument` now calls it internally. Remove the duplicate call
to avoid writing two `application_step_completions` rows.

---

## 6. Mock application compatibility

`mock-application.ts` steps have `document_requirement_id: null`. When
`?mock=true`, the modal's `requirementId` will be null/undefined. Guard
against this in `uploadDocument` — if `requirementId` is missing or invalid,
return early with a clear error. The mock upload simulation can remain for
the mock flow only:

```typescript
// In DocumentUploadModal — keep the simulation path for mock mode
if (!requirementId) {
  // mock flow — keep existing setTimeout simulation
  simulateMockUpload()
  return
}
// real flow
handleUpload()
```

---

## 7. Files to Create / Modify

```
supabase/
  config.toml                                     ← add bucket definition
  migrations/
    20260528000006_storage_documents_bucket.sql   ← CREATE (run in SQL editor too)

src/
  app/applications/
    actions.ts                                    ← add uploadDocument action
  components/application/
    modals/DocumentUploadModal.tsx                ← replace setTimeout with real upload
    steps/DocumentUploadStep.tsx                  ← pass requirementId, remove duplicate completeStep
```

---

## 8. Implementation Notes for Cursor

- Read `src/app/applications/actions.ts` in full before editing — match the
  existing auth-guard pattern exactly
- Read `src/components/application/modals/DocumentUploadModal.tsx` in full
  before editing — preserve all existing UI states and design system classes,
  only replace the upload handler
- The `uploadDocument` action uses `FormData` because `File` objects cannot
  be passed directly through Next.js server actions
- `createSupabaseServerClient` is already used throughout the codebase —
  use the same import pattern, do not introduce a new Supabase client
- Do not add new npm packages — the Supabase client already supports storage
- TypeScript strict mode — all new function parameters and return types must
  be explicitly typed
- Run `npx tsc --noEmit` and `npx jest` after completing all changes
- The bucket must be created in the SQL editor (Supabase remote) before
  testing — the config.toml change only affects local dev