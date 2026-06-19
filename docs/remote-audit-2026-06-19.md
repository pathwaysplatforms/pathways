# Remote Supabase Audit Report

**Project ref:** oqiikkkwvpjnfgliryyl  
**Date:** 2026-06-19  
**Method:** Read-only queries via PostgREST API (service role key). No writes made to local or remote.

---

## 1. Remote Pathway Inventory — 23 total

| # | Title | Slug | Steps | Docs |
|---|---|---|---|---|
| 1 | Alberta Advantage Immigration Program (AAIP) | canada-pnp-alberta | **0** | **0** |
| 2 | Atlantic Immigration Program (AIP) | canada-atlantic-immigration | 8 | 8 |
| 3 | BC Provincial Nominee Program (BC PNP) | canada-pnp-bc | **0** | **0** |
| 4 | Bridging Open Work Permit (BOWP) | canada-bowp | 7 | 6 |
| 5 | Canadian Experience Class | express-entry-cec | 10 | 7 |
| 6 | Canadian Experience Class (CEC) | canada-cec | 8 | 6 |
| 7 | Express Entry | express-entry | 5 | **0** |
| 8 | Express Entry – Federal Skilled Worker | canada-express-entry-fsw | 8 | 7 |
| 9 | Express Entry – STEM Category Draw | canada-express-entry-stem | 8 | 4 |
| 10 | Express Entry — STEM Category | express-entry-stem | 8 | 4 |
| 11 | Family Sponsorship | canada-family-sponsorship | 8 | 5 |
| 12 | Federal Skilled Trades Program (FSTP) | canada-fstp | 8 | 9 |
| 13 | Federal Skilled Worker | express-entry-fsw | 12 | 8 |
| 14 | Home Child Care Provider & Home Support Worker Pilots | canada-caregiver | 6 | 2 |
| 15 | Ontario Immigrant Nominee Program (OINP) | canada-pnp-ontario | 8 | 11 |
| 16 | Post-Graduation Work Permit | pgwp | 3 | **0** |
| 17 | Post-Graduation Work Permit (PGWP) | canada-pgwp | 8 | 5 |
| 18 | Provincial Nominee Program | provincial-nominee | 3 | **0** |
| 19 | Rural and Northern Immigration Pilot (RNIP) | canada-rnip | 6 | **0** |
| 20 | Start-up Visa Program | canada-startup-visa | 8 | 12 |
| 21 | UK Global Talent Visa | uk-global-talent-visa | **0** | 4 |
| 22 | UK Skilled Worker Visa | uk-skilled-worker-visa | **0** | 5 |
| 23 | UK Student Visa | uk-student-visa | **0** | 6 |
| | **TOTALS** | | **134 steps** | **109 docs** |

---

## 2. "13 Canadian pathways" — Actual count and duplicates

Remote has **20 Canadian pathway rows**, not 13. However, at least **4 are duplicate pairs** — the same pathway seeded twice under two different slugs. Probable cause: an initial seeding used generic slugs (e.g. `express-entry-cec`) and a later batch re-seeded the same content under `canada-*` namespaced slugs.

| Duplicate pair | Old slug (kept?) | New slug (`canada-*`) |
|---|---|---|
| Canadian Experience Class | `express-entry-cec` (10 steps, 7 docs) | `canada-cec` (8 steps, 6 docs) |
| Post-Graduation Work Permit | `pgwp` (3 steps, 0 docs) | `canada-pgwp` (8 steps, 5 docs) |
| Federal Skilled Worker | `express-entry-fsw` (12 steps, 8 docs) | `canada-express-entry-fsw` (8 steps, 7 docs) |
| Express Entry STEM | `express-entry-stem` (8 steps, 4 docs) | `canada-express-entry-stem` (8 steps, 4 docs) |

After removing these 4 duplicate old-slug rows, **16 distinct Canadian pathways** exist on remote. The "13" figure is not matched by either the raw count or the de-duplicated count. The original proposal was likely written before later pathways were added.

**Unique Canadian pathways (16 distinct, post-deduplication):**
1. Alberta Advantage Immigration Program (AAIP)
2. Atlantic Immigration Program (AIP)
3. BC Provincial Nominee Program (BC PNP)
4. Bridging Open Work Permit (BOWP)
5. Canadian Experience Class *(one copy — `canada-cec` preferred, has more content)*
6. Express Entry (generic)
7. Express Entry – Federal Skilled Worker *(one copy — `canada-express-entry-fsw` preferred)*
8. Express Entry – STEM Category *(one copy — either; content is identical)*
9. Family Sponsorship
10. Federal Skilled Trades Program (FSTP)
11. Home Child Care Provider & Home Support Worker Pilots
12. Ontario Immigrant Nominee Program (OINP)
13. Post-Graduation Work Permit *(one copy — `canada-pgwp` preferred, has more content)*
14. Provincial Nominee Program
15. Rural and Northern Immigration Pilot (RNIP)
16. Start-up Visa Program

---

## 3. UK pathways on remote

All three UK pathways are **present** on remote.

| Pathway | Steps | Docs | Notes |
|---|---|---|---|
| UK Global Talent Visa | **0** | 4 | No steps authored |
| UK Skilled Worker Visa | **0** | 5 | No steps authored |
| UK Student Visa | **0** | 6 | No steps authored |

This is consistent with local. UK pathways have document requirements but no `pathway_steps` on either environment.

---

## 4. Migration `20260619000001` — NOT applied to remote

This is the highest-severity finding in this audit.

Migration `20260619000001_application_step_types_and_step_docs.sql` added:
- `pathway_steps.type` column (CHECK constraint: `document_upload | information | external_action | review`)
- `document_requirements.step_id` column (FK to `pathway_steps`)

Both columns **do not exist on the remote database**. Queries against either column fail with `column does not exist`. The migration has been applied locally but **has never been deployed to production**.

Any feature code that reads or writes `pathway_steps.type` or `document_requirements.step_id` will fail with a 400/500 error against the remote instance.

---

## 5. Document requirements duplicate issue — remote is clean

The 15-duplicate-row issue found in the local database (30 rows instead of 15 for UK pathways, caused by both a migration seed and `seed.sql` running without a UNIQUE constraint) is **not present on remote**.

| UK pathway | Local doc rows | Remote doc rows | Local duplicates? |
|---|---|---|---|
| UK Skilled Worker Visa | 10 | **5** | Yes — 5 dupes locally |
| UK Student Visa | 12 | **6** | Yes — 6 dupes locally |
| UK Global Talent Visa | 8 | **4** | Yes — 4 dupes locally |

Remote has exactly the expected unique count. **The duplication issue is local-only and was introduced by `seed.sql` re-inserting rows that the migration had already inserted.**

---

## 6. Local vs remote drift summary

### Schema drift (most urgent)

| Column | Local | Remote |
|---|---|---|
| `pathway_steps.type` | ✓ exists | ✗ missing |
| `document_requirements.step_id` | ✓ exists | ✗ missing |
| `document_requirements_step_id_idx` index | ✓ exists | ✗ missing |

**Root cause:** Migration `20260619000001` applied locally, never run on remote.

### Data drift — pathways

| Pathway (slug) | Local | Remote |
|---|---|---|
| express-entry | ✓ (id: 89a12fe2) | ✓ (id: d0cdb5cd) — **different UUID** |
| pgwp | ✓ (id: 17a9a108) | ✓ (id: 4d3ab0e9) — **different UUID** |
| provincial-nominee | ✓ (id: 1bb80400) | ✓ (id: 003896b6) — **different UUID** |
| uk-global-talent-visa | ✓ (id: 32dca8bb) | ✓ (id: d6e092e6) — **different UUID** |
| uk-skilled-worker-visa | ✓ (id: 9975218a) | ✓ (id: e1389171) — **different UUID** |
| uk-student-visa | ✓ (id: 9029fefa) | ✓ (id: 7e47c414) — **different UUID** |
| canada-pnp-alberta | ✗ missing | ✓ |
| canada-atlantic-immigration | ✗ missing | ✓ |
| canada-pnp-bc | ✗ missing | ✓ |
| canada-bowp | ✗ missing | ✓ |
| express-entry-cec | ✗ missing | ✓ |
| canada-cec | ✗ missing | ✓ |
| canada-express-entry-fsw | ✗ missing | ✓ |
| canada-express-entry-stem | ✗ missing | ✓ |
| express-entry-stem | ✗ missing | ✓ |
| canada-family-sponsorship | ✗ missing | ✓ |
| canada-fstp | ✗ missing | ✓ |
| express-entry-fsw | ✗ missing | ✓ |
| canada-caregiver | ✗ missing | ✓ |
| canada-pnp-ontario | ✗ missing | ✓ |
| canada-pgwp | ✗ missing | ✓ |
| canada-rnip | ✗ missing | ✓ |
| canada-startup-visa | ✗ missing | ✓ |

**Same slug, different UUIDs:** The 6 pathways that exist in both environments were seeded independently — they have the same slugs and titles but entirely different UUIDs, pathway_steps IDs, and document_requirements IDs. Local and remote cannot be reconciled by a simple data sync; they are parallel seedings of the same templates.

### Data drift — pathway_steps

- Local has 11 pathway_steps rows (Express Entry ×5, PGWP ×3, PNP ×3, same titles as remote)
- Remote has 134 pathway_steps rows across 18 pathways
- The 3 Canadian pathways that exist in both environments have the same step content but **different step UUIDs**

### Data drift — document_requirements

- Local has 30 rows (UK pathways only, 15 dupes — local bug)
- Remote has 109 rows (Canadian pathways with rich docs + UK pathways with clean docs)
- Express Entry, PGWP, and Provincial Nominee Program have **0 document_requirements on both local and remote**

---

## 7. Key action items (audit findings only — not implementing)

| Priority | Issue | Scope |
|---|---|---|
| **P0** | Apply migration `20260619000001` to remote before any code that uses `pathway_steps.type` or `document_requirements.step_id` is deployed | Remote schema |
| **P1** | Fix local `document_requirements` duplicates (30 rows → 15) — dedup + add UNIQUE constraint | Local data |
| **P2** | Resolve duplicate `canada-*` / old-slug pathway pairs on remote (4 pairs) — decide canonical slug and delete the stale row | Remote data |
| **P3** | UK pathways on remote have no `pathway_steps` — backfill proposal cannot set any `step_id` values until steps are authored | Remote data |
| **P4** | Local is missing 17 pathways present on remote; local seeds need to be brought in sync if local dev should mirror production | Local data |

*End of audit. No writes were made.*
