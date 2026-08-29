# Backfill Proposal: `pathway_steps.type` and `document_requirements.step_id`

**Status:** Draft for human review — no DB writes, no migration created.  
**Generated:** 2026-06-19  
**Scope:** All rows currently in the local Supabase instance.

---

## Pre-flight: Closed Vocabulary Audit

### Phase 1A — Step type components found

| File | Type string | UI / interaction provided |
|---|---|---|
| `InformationStep.tsx` | `information` | Read-only prose block. User reads and clicks "Continue". Stub note: form fields pending profile schema. |
| `ExternalActionStep.tsx` | `external_action` | Description block + "Open external portal →" link + confirmation checkbox. User checks "I confirm I have completed this step outside of the app." |
| `DocumentUploadStep.tsx` | `document_upload` | Document info row + "Upload [name] →" CTA + `DocumentUploadModal`. Requires a linked `document_requirements` row. |
| `ReviewStep.tsx` | `review` | Read-only summary of submitted docs/info before submission. Stub note: full content pending prior steps being completeable. |

### Phase 1B — CHECK constraint (migration `20260619000001`)

```sql
check (type in ('document_upload', 'information', 'external_action', 'review'))
```

**Allowed by constraint:** `document_upload`, `information`, `external_action`, `review`  
**Components with real UI:** `document_upload`, `information`, `external_action`, `review`

**Verdict:** Perfect 1-to-1 match. No constraint value lacks a component; no component lacks a constraint value. ✓

---

## Pre-flight: Data Inventory (actual DB state)

> **⚠ Discrepancy with task description:** The task references 13 pathways. The local database contains **6 pathways**. The proposal covers all 6. If additional pathways are seeded later this proposal must be re-run for those rows.

| Pathway | Steps | Document requirements |
|---|---|---|
| Express Entry | 5 | 0 |
| Post-Graduation Work Permit | 3 | 0 |
| Provincial Nominee Program | 3 | 0 |
| UK Skilled Worker Visa | 0 | 10* |
| UK Student Visa | 0 | 12* |
| UK Global Talent Visa | 0 | 8* |

**\* Duplicate rows flagged below.**

### ⚠ Data quality issue: duplicate `document_requirements` rows

Each UK pathway's document requirements appear **twice** (two rows per document, different UUIDs, identical content). Root cause: both `20260515000007_seed_reference_data.sql` and `seed.sql` insert the same rows, but neither the migration nor `seed.sql` has a `UNIQUE` constraint on `(pathway_id, name)` — so `ON CONFLICT DO NOTHING` never fires and both inserts succeed.

**This duplication must be resolved before `step_id` is set, otherwise any UI that queries document_requirements will show each document twice.** Deduplication strategy (for your decision): keep the row with the lower `sort_order` (they're identical on that field too, so keep the row with the lexicographically smaller `id`), or add a `UNIQUE (pathway_id, name)` constraint and delete duplicates via migration. This proposal calls out duplicates in the tables below; `step_id` mappings reference the first-encountered row (lower UUID) as the canonical one.

### ⚠ Structural gap: UK pathways have no `pathway_steps`

All 30 `document_requirements` rows belong to UK pathways. UK pathways have **zero** `pathway_steps` rows. There is no step to link these documents to. All UK document `step_id` values must remain `NULL` (pathway-level requirements) until UK pathway steps are authored. This is correct per the migration comment: *"Pathway-level requirements keep step_id = NULL."*

### ⚠ Structural gap: Canadian pathways have no `document_requirements`

Express Entry, PGWP, and PNP all have steps but zero document requirements. Steps that logically involve a document upload (e.g., "Submit Permanent Residency Application" requires gathering physical documents) cannot be typed as `document_upload` without a corresponding `document_requirements` row. These steps are therefore proposed as `external_action` or `information`, which are safe without a document row.

---

## Pathway 1 — Express Entry

**Pathway ID:** `89a12fe2-b1be-435d-9430-3d9de462caa1`

### Steps

| step_id | step_title | current_type | proposed_type | confidence | reasoning |
|---|---|---|---|---|---|
| `bdab0f9a-f96b-4364-aefb-669f7a76fde9` | Educational Credential Assessment | `information` | `external_action` | **high** | Description: *"Have your foreign educational credentials assessed by a designated organisation such as WES"* — action happens entirely off-platform at WES or equivalent; user must complete it and confirm. Maps to ExternalActionStep's confirmation-checkbox pattern. |
| `f66dd8fc-edc7-4c25-a334-d00e005f36bb` | Language Testing | `information` | `external_action` | **high** | Description: *"Complete an approved English or French language test (IELTS General Training or CELPIP…)"* — test is taken at an external provider; user completes off-platform and confirms. |
| `f79cee98-0e01-44b4-b6ed-ec081a8a7b17` | Create Express Entry Profile | `information` | `external_action` | **high** | Description: *"Submit your Express Entry profile on the IRCC portal"* — submission happens on the IRCC portal, not in this app; ExternalActionStep link text should open `ircc.canada.ca`. |
| `20822c7e-b265-402c-a57c-0146586f9763` | Wait for Invitation to Apply | `information` | `information` | **high** | Description: *"Your profile sits in the Express Entry pool. IRCC holds regular draws and issues ITAs to the highest-ranked candidates."* — passive waiting state; no user action possible. Information step is correct. |
| `95576d2c-4800-483a-86d1-7af14faef771` | Submit Permanent Residency Application | `information` | `external_action` | **high** | Description: *"you have 60 days to submit a complete online application for permanent residency … pay the processing fee"* — submission is on IRCC's portal. Although documents are gathered, no `document_requirements` rows exist for this pathway; uploading within the app is not yet wired. ExternalActionStep is the appropriate fallback. |

### Document requirements

No `document_requirements` rows exist for Express Entry. Table omitted.

---

## Pathway 2 — Post-Graduation Work Permit (PGWP)

**Pathway ID:** `17a9a108-4ee8-4af9-92bc-8f0df2359782`

### Steps

| step_id | step_title | current_type | proposed_type | confidence | reasoning |
|---|---|---|---|---|---|
| `d408a832-635a-4c75-8595-c8db3e0223a5` | Graduate from a Designated Learning Institution | `information` | `information` | **uncertain** | Description: *"Complete your full-time program (minimum 8 months) at an eligible DLI."* — this describes a prerequisite status already achieved before applying, not an in-app action. No external portal to link to; no document to upload at this step. `information` is the safe default. Could become `document_upload` if a graduation certificate requirement is added later. |
| `e9dd5b7d-0770-436e-9e85-314b72049a31` | Apply for Your PGWP | `information` | `external_action` | **high** | Description: *"You can apply online through your IRCC account."* — explicit off-platform submission on IRCC; ExternalActionStep confirmation pattern is correct. |
| `5489415c-6afb-4b94-84a2-fcf9d2338833` | Work and Build Canadian Experience | `information` | `information` | **high** | Description: *"Use your open PGWP to work for any Canadian employer in any occupation."* — ongoing informational guidance, no discrete action to take within the app. |

### Document requirements

No `document_requirements` rows exist for PGWP. Table omitted.

---

## Pathway 3 — Provincial Nominee Program (PNP)

**Pathway ID:** `1bb80400-fa6a-444c-b93b-c59983545d9a`

### Steps

| step_id | step_title | current_type | proposed_type | confidence | reasoning |
|---|---|---|---|---|---|
| `ca5def38-88ed-4cf4-954d-f0959c8ed2b7` | Choose a Province and Stream | `information` | `information` | **high** | Description: *"Research provincial nomination streams that match your skills…"* — a research and decision step with no external portal action or document upload. `information` is correct. |
| `b0659c7c-8706-430b-b323-13fcec6ca94a` | Submit Provincial Application | `information` | `external_action` | **high** | Description: *"Apply directly to your chosen provincial government stream."* — submission is on the provincial government's own website, off-platform. ExternalActionStep confirmation pattern applies. |
| `d6251cb4-a575-4953-a5aa-23c14aee0334` | Apply for Permanent Residency | `information` | `external_action` | **high** | Description: *"apply for Canadian PR, either through Express Entry … or the paper-based PNP stream"* — submission is on IRCC's portal or by paper, both off-platform. |

### Document requirements

No `document_requirements` rows exist for PNP. Table omitted.

---

## Pathway 4 — UK Skilled Worker Visa

**Pathway ID:** `9975218a-dbb5-4534-9288-690bbad97303`

### Steps

No `pathway_steps` rows exist for this pathway. Steps table omitted.  
**Action needed before step_id can be set:** author `pathway_steps` for this pathway.

### Document requirements

⚠ All rows are `step_id = NULL` (unmatched) because no steps exist. Duplicate rows are flagged — keep the first row in each pair (lower sort_order UUID recommended).

| document_id | document_title | proposed_step_id | proposed_step_title | confidence | reasoning |
|---|---|---|---|---|---|
| `7718f56f-ab35-4212-a5e2-301ff438a8d6` | Valid passport or travel document | — | — | **unmatched** | No pathway_steps exist for this pathway; cannot link. Remains pathway-level. |
| `67620ba9-845e-46f2-9c29-3ebbf0ca6c8e` | Valid passport or travel document *(duplicate)* | — | — | **unmatched** | Duplicate of above. Should be deleted. |
| `f4ef5f89-ab85-4fe6-9c09-5ce33303b8a1` | Certificate of Sponsorship | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `d22934e3-ac6b-497f-a5d3-c84900ec2d3d` | Certificate of Sponsorship *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `319a87d8-d3c2-4409-a931-61641dcf927a` | English language evidence | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `2617ae24-f96b-4c05-8d44-e0e18c27ebbf` | English language evidence *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `7091a72f-dec8-4b03-9bd0-b5b98c441b69` | Financial evidence | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `88cb97d6-69a7-4de6-8ba4-7229942ff6ec` | Financial evidence *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `27888169-4248-460c-90c3-8f48d9d9f374` | Tuberculosis test results | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `bae5522a-f54c-4159-ad48-d7d25a9edc58` | Tuberculosis test results *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |

---

## Pathway 5 — UK Student Visa

**Pathway ID:** `9029fefa-e332-408d-9047-10a51b57a386`

### Steps

No `pathway_steps` rows exist for this pathway. Steps table omitted.  
**Action needed before step_id can be set:** author `pathway_steps` for this pathway.

### Document requirements

⚠ All rows are `step_id = NULL` (unmatched). Duplicates flagged.

| document_id | document_title | proposed_step_id | proposed_step_title | confidence | reasoning |
|---|---|---|---|---|---|
| `15e01d7d-e015-49a6-b604-93050224086e` | Valid passport | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `650239bc-a6fe-40e1-beb6-79e797591e98` | Valid passport *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `4bd0eb80-de47-463d-b5fe-31acbeec13a5` | Confirmation of Acceptance for Studies (CAS) | — | — | **unmatched** | No steps exist. Remains pathway-level. When a "Obtain CAS" step is authored, this should link to it as `document_upload`. |
| `96038a0f-3ea6-44db-81f8-c0e88628fdf2` | Confirmation of Acceptance for Studies (CAS) *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `a2ee4823-5fd3-42c9-8f3e-758db318d432` | English language test results | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `d909c886-27c9-461f-9127-707d817f4f03` | English language test results *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `2161b45f-2b72-4bc2-b883-f55b04133623` | Financial evidence | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `e8e79402-d4c8-4314-ba6f-2d0b6bf778a3` | Financial evidence *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `341d8d10-f70d-45c2-8821-4fe91c251fd0` | Academic transcripts and qualifications | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `c3171007-e545-4dfc-9753-899d661e4ce6` | Academic transcripts and qualifications *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `7532d25f-4ce0-4769-9fe9-a6682674dd9f` | ATAS clearance certificate | — | — | **unmatched** | No steps exist. Remains pathway-level. Optional document (is_mandatory = false). |
| `7f7e02f9-5a5f-41d7-99d7-4a282c710693` | ATAS clearance certificate *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |

---

## Pathway 6 — UK Global Talent Visa

**Pathway ID:** `32dca8bb-3c4c-4a02-a621-60237dd9d934`

### Steps

No `pathway_steps` rows exist for this pathway. Steps table omitted.  
**Action needed before step_id can be set:** author `pathway_steps` for this pathway.

### Document requirements

⚠ All rows are `step_id = NULL` (unmatched). Duplicates flagged.

| document_id | document_title | proposed_step_id | proposed_step_title | confidence | reasoning |
|---|---|---|---|---|---|
| `3fc7dfa2-148a-4b42-9805-b1c0d47e1c7c` | Valid passport | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `376ae130-479b-4f7f-a427-5a847096f868` | Valid passport *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `eae8d1d9-38fd-4336-95eb-17736f8ab5d9` | Endorsement letter | — | — | **unmatched** | No steps exist. When an "Obtain Endorsement" step is authored, this is the natural `document_upload` target. |
| `7a631385-f16b-4b50-8b08-dde0a5b37699` | Endorsement letter *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `acd7c27b-830e-4b23-b8c1-b652505d7587` | Evidence of exceptional talent or promise | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `26662d92-5d15-4967-b858-05c26a7dece3` | Evidence of exceptional talent or promise *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |
| `fb32b9a9-2b21-4dd7-ba5d-8aa4b25c1a58` | CV and professional profile | — | — | **unmatched** | No steps exist. Remains pathway-level. |
| `ee0641b5-0abb-4204-936c-f2f9eedd1f08` | CV and professional profile *(duplicate)* | — | — | **unmatched** | Duplicate. Should be deleted. |

---

## Summary of proposed changes

### `pathway_steps.type` changes (11 rows)

| Pathway | Step | current → proposed |
|---|---|---|
| Express Entry | Educational Credential Assessment | `information` → `external_action` |
| Express Entry | Language Testing | `information` → `external_action` |
| Express Entry | Create Express Entry Profile | `information` → `external_action` |
| Express Entry | Wait for Invitation to Apply | `information` → `information` (no change) |
| Express Entry | Submit Permanent Residency Application | `information` → `external_action` |
| PGWP | Graduate from a Designated Learning Institution | `information` → `information` (uncertain — flag) |
| PGWP | Apply for Your PGWP | `information` → `external_action` |
| PGWP | Work and Build Canadian Experience | `information` → `information` (no change) |
| PNP | Choose a Province and Stream | `information` → `information` (no change) |
| PNP | Submit Provincial Application | `information` → `external_action` |
| PNP | Apply for Permanent Residency | `information` → `external_action` |

**Net changes:** 6 rows flipped to `external_action`, 5 rows unchanged.  
**Uncertain:** 1 row (`Graduate from a DLI`) — flagged above.

### `document_requirements.step_id` changes

**0 step_id values can be set.** All 30 document rows belong to UK pathways which have no `pathway_steps`. All remain `NULL` until UK steps are authored.

### Blocking issues to resolve before migration

1. **Duplicate document rows (15 duplicates across 3 pathways)** — decide which rows to keep and delete the rest. Recommend adding a `UNIQUE (pathway_id, name)` constraint to prevent recurrence.
2. **UK pathway_steps not authored** — the three UK pathways need steps before document-to-step linking can happen.
3. **Canadian pathway document_requirements not authored** — Express Entry step 5 ("Submit Permanent Residency Application") and others would benefit from linked `document_upload` steps, but this requires new document_requirements rows, which is a separate content authoring task.
4. **`document_upload` type unused** — no step currently has type `document_upload` because no Canadian pathway has document_requirements. The type is safe (constraint + component both exist) but will remain dead code until the above gap is closed.

---

*Stop here — awaiting approval before any further action.*
