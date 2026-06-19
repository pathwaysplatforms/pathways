# Canadian Pathway Steps — Type Classification Proposal

**Date:** 2026-06-19  
**Data:** 107 steps across 14 pathways · 86 document requirements  
**Scope:** Audit-only — no SQL writes. Stop here for review before any migration.

**Excluded (0 rows each, separate content-authoring task):**
- AAIP (Alberta Advantage Immigration Program)
- BC PNP (British Columbia Provincial Nominee Program)

**canada-startup-visa confirmation:** 8 steps retrieved ✓ (previously showed 1)

---

## Legend

**Proposed type values:** `information` · `document_upload` · `external_action`  
**Flags:**
- ⚠️ uncertain — step doesn't fit a single pattern cleanly; keeping `information` as safe default
- 🔗 linked — doc_requirement gets a step_id set to this step
- ⛔ no-mandatory — document_upload step where all linked docs are is_mandatory=false

---

## 1 · Atlantic Immigration Program (AIP)

`canada-atlantic-immigration` · 8 steps · 8 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 77dfa779 | Determine eligibility and gather required documents | information | **information** | ⚠️ uncertain: compound eligibility + gather; no single named doc |
| 2 | d8537f5e | Secure job offer from designated employer | information | **information** | ⚠️ uncertain: employment search, not portal submission or doc gather |
| 3 | f955e3b3 | Develop settlement plan with service provider | information | **document_upload** | "Develop" + named doc "Settlement plan" matches → 🔗 |
| 4 | 4c0d73cf | Employer submits endorsement application | information | **information** | ⚠️ uncertain: employer action, not applicant action |
| 5 | 7a79985c | Receive provincial endorsement certificate | information | **information** | "Receive" pattern |
| 6 | ebd2b6fc | Apply for work permit (if required) | information | **external_action** | "Apply" to IRCC; is_optional=true |
| 7 | 65e9e23d | Submit permanent residence application to IRCC | information | **external_action** | "Submit" to IRCC |
| 8 | 395d8e3e | IRCC reviews and approves PR application | information | **information** | "Wait/receive" pattern |

**Type changes:** 3 → document_upload; 6, 7 → external_action  
**Uncertain:** steps 1, 2, 4

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Language test results | ✓ | d17ff077 | — | unmatched |
| Proof of work experience | — | 5cd739eb | — | unmatched |
| Valid passport or travel document | ✓ | d067ca37 | — | unmatched |
| Proof of settlement funds | — | c6b87257 | — | unmatched |
| Provincial endorsement certificate | ✓ | cda28555 | — | unmatched (received at step 5; submitted at step 7 which is external_action, not gather) |
| Work permit support letter | — | 1593a53e | — | unmatched |
| Settlement plan | ✓ | d8f61d7e | **f955e3b3** (step 3 — Develop settlement plan) | 🔗 matched |
| Educational credential or ECA report | ✓ | d4bd9e7b | — | unmatched |

**Linked:** 1 doc · **Unmatched:** 7

---

## 2 · Bridging Open Work Permit (BOWP)

`canada-bowp` · 7 steps · 6 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 162633b9 | Determine your permanent residence program | information | **information** | "Determine" pattern |
| 2 | 23ca40dc | Confirm eligibility requirements | information | **information** | "Confirm eligibility" pattern |
| 3 | 995f8c40 | Gather required documents | information | **information** | ⚠️ uncertain: step title is generic; description names 5+ distinct documents, not one |
| 4 | 1d223fcf | Prepare work permit extension application | information | **information** | ⚠️ uncertain: preparation step, no portal submission yet |
| 5 | 8d543dde | Calculate and prepare fees | information | **information** | ⚠️ uncertain: fee calculation, not a doc gather or portal submission |
| 6 | dbf435ad | Submit BOWP application online | information | **external_action** | "Submit … online" via IRCC portal |
| 7 | 3315bbc9 | Monitor application status | information | **information** | "Wait/monitor" pattern |

**Type changes:** 6 → external_action  
**Uncertain:** steps 3, 4, 5

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Approval in principle letter | — | 18d36a22 | — | unmatched (step 3 uncertain) |
| Nomination letter | — | 1e746c7f | — | unmatched |
| Certificat de sélection du Québec (CSQ) | — | 0f7c4f18 | — | unmatched |
| Acknowledgement of receipt letter | ✓ | 935ca837 | — | unmatched |
| Permanent residence application number letter | — | 32a95ac5 | — | unmatched |
| Supporting documents from checklist | ✓ | 6d05f1d9 | — | unmatched (generic catch-all) |

**Linked:** 0 · **Unmatched:** 6

---

## 3 · Canadian Experience Class (CEC)

`canada-cec` · 11 steps · 10 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | c6b9f168 | Determine your NOC code and verify TEER level | information | **information** | "Determine/verify" pattern |
| 2 | aa34730d | Verify Canadian work experience eligibility | information | **information** | "Verify" pattern |
| 3 | 09beead0 | Take and pass approved language tests | information | **information** | ⚠️ uncertain: taking a test is a physical/external action but not an IRCC portal submission |
| 4 | 94dd6341 | Gather educational credentials (if applicable) | information | **document_upload** | "Gather" + two matching named docs → 🔗; is_optional=true |
| 5 | b47742f3 | Confirm admissibility to Canada | information | **information** | "Confirm" pattern |
| 6 | 599b6d88 | Decide on province or territory of residence | information | **information** | Decision/planning step |
| 7 | 3bba1186 | Create Express Entry profile | information | **information** | Creating a profile (not submitting final application) |
| 8 | 27b7025d | Submit application after Invitation to Apply | information | **external_action** | "Submit" full e-APR to IRCC |
| 9 | 64409e48 | Complete biometrics | information | **information** | ⚠️ uncertain: in-person VAC appointment, not an online portal submission |
| 10 | ddf73cc0 | Complete medical exam | information | **information** | ⚠️ uncertain: in-person panel physician appointment |
| 11 | 323ad11f | Receive Confirmation of Permanent Residence | information | **information** | "Receive" pattern |

**Type changes:** 4 → document_upload; 8 → external_action  
**Uncertain:** steps 3, 9, 10

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Educational credential assessment (ECA) report | — | 91ebdfef | **94dd6341** (step 4 — Gather educational credentials) | 🔗 matched |
| Proof of settlement plans outside Quebec | ✓ | 9430bda2 | — | unmatched (no specific gather step) |
| Approved language test results | ✓ | 5d3e7057 | — | unmatched (step 3 is "take" not "gather") |
| NOC job description and evidence of duties | ✓ | 4765ced0 | — | unmatched |
| Canadian work experience documentation | ✓ | 878bffb9 | — | unmatched (step 2 is "verify" not "gather") |
| Canadian education credential | — | 1c5313f7 | **94dd6341** (step 4 — Gather educational credentials) | 🔗 matched |
| Valid passport | ✓ | 787608ee | — | unmatched |
| Police certificates | ✓ | 6a7d1a89 | — | unmatched |
| Medical exam results | ✓ | 03061676 | — | unmatched (step 10 is information/uncertain, not gather) |
| Digital photo | ✓ | 72200832 | — | unmatched |

⛔ **No-mandatory flag:** step 4 (document_upload) — both linked docs (ECA, Canadian credential) have is_mandatory=false. Step is conditional on having foreign or Canadian education to claim points.

**Linked:** 2 docs · **Unmatched:** 8

---

## 4 · Express Entry

`express-entry` · 5 steps · 0 docs

Generic/umbrella Express Entry pathway. No document requirements rows exist.

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 6c4cdf5d | Educational Credential Assessment | information | **information** | ⚠️ uncertain: an action (getting ECA done) but no doc rows to link and not a portal submission |
| 2 | b3527953 | Language Testing | information | **information** | ⚠️ uncertain: same pattern as CEC step 3 — physical/external test, not portal submission |
| 3 | c97f8192 | Create Express Entry Profile | information | **information** | Creating profile, not submitting final application |
| 4 | d2de8d71 | Wait for Invitation to Apply | information | **information** | "Wait" pattern |
| 5 | 86fb5100 | Submit Permanent Residency Application | information | **external_action** | "Submit" online to IRCC post-ITA |

**Type changes:** 5 → external_action  
**Uncertain:** steps 1, 2  
**Docs:** none

---

## 5 · Express Entry – Federal Skilled Worker

`canada-express-entry-fsw` · 12 steps · 11 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 53938a38 | Determine your NOC and verify TEER eligibility | information | **information** | "Determine/verify" pattern |
| 2 | d99d680e | Verify skilled work experience requirements | information | **information** | "Verify" pattern |
| 3 | eea32e84 | Take approved language tests | information | **information** | ⚠️ uncertain: taking test, not IRCC portal submission |
| 4 | 131d2857 | Obtain Educational Credential Assessment if applicable | information | **document_upload** | "Obtain" + named doc "Educational Credential Assessment report" → 🔗; is_optional=true |
| 5 | 92f5b596 | Score your selection factors and verify the 67-point minimum | information | **information** | "Verify/score" — calculation step |
| 6 | 5c93acd5 | Gather proof of funds if required | information | **document_upload** | "Gather proof of funds" + named doc "Proof of funds" → 🔗; is_optional=true |
| 7 | 03cd6725 | Create and submit Express Entry profile | information | **external_action** | ⚠️ uncertain: "submit" profile to IRCC pool online — is an online submission but not a final PR application; flagged |
| 8 | b96724ea | Await invitation to apply for permanent residence | information | **information** | "Await" pattern |
| 9 | 013d8023 | Submit e-APR within 60 days | information | **external_action** | "Submit" via IRCC portal; 60-day window |
| 10 | 674e5c91 | Complete biometrics | information | **information** | ⚠️ uncertain: in-person VAC appointment |
| 11 | e22ff223 | Complete medical exam | information | **information** | ⚠️ uncertain: in-person panel physician |
| 12 | 04a506a7 | Receive Confirmation of Permanent Residence | information | **information** | "Receive" pattern |

**Type changes:** 4 → document_upload; 6 → document_upload; 7 → external_action (⚠️ uncertain); 9 → external_action  
**Uncertain:** steps 3, 7, 10, 11

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Proof of funds | ✓ | 8ace1509 | **5c93acd5** (step 6 — Gather proof of funds if required) | 🔗 matched |
| Employment letters | ✓ | e812eb97 | — | unmatched (no gather step for employment letters) |
| Canadian education credential | — | ba1838e8 | — | unmatched (step 4 title says "Obtain ECA", not "gather Canadian credential") |
| Educational Credential Assessment report | — | 706471f4 | **131d2857** (step 4 — Obtain Educational Credential Assessment) | 🔗 matched |
| Language test results | ✓ | e2c3dec2 | — | unmatched (step 3 is "take" not "gather") |
| Job offer letter | — | 34f2675f | — | unmatched |
| Spouse language test results | — | 6ad897a1 | — | unmatched |
| Valid passport | ✓ | 94e02d9e | — | unmatched |
| Police certificates | ✓ | 04df6fc2 | — | unmatched |
| Medical exam results | ✓ | bece735d | — | unmatched |
| Digital photo | ✓ | 71704ab4 | — | unmatched |

⛔ **No-mandatory flag:** step 4 (document_upload) — linked doc "Educational Credential Assessment report" has is_mandatory=false (ECA only required if claiming foreign education points).

**Linked:** 2 docs · **Unmatched:** 9

---

## 6 · Express Entry – STEM Category Draw

`canada-express-entry-stem` · 9 steps · 6 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 6d5ae3cf | Show your interest and create Express Entry profile | information | **information** | Creating profile, not final PR submission |
| 2 | c05c8c82 | Confirm your NOC code is STEM-eligible | information | **information** | "Confirm" pattern |
| 3 | 70269ca3 | Confirm eligibility for Express Entry program | information | **information** | "Confirm eligibility" pattern |
| 4 | 28c5d177 | Get placed in Express Entry pool | information | **information** | "Receive placement" pattern |
| 5 | d171ff16 | Receive Comprehensive Ranking System score | information | **information** | "Receive" pattern |
| 6 | 2ace6722 | Wait for category-based round | information | **information** | "Wait" pattern |
| 7 | 2a0b214b | Receive invitation to apply | information | **information** | "Receive" pattern |
| 8 | 477500dd | Submit permanent residence application | information | **external_action** | "Submit" full PR application within 60 days |
| 9 | 0c815321 | Receive decision on application | information | **information** | "Receive" pattern |

**Type changes:** 8 → external_action  
**Uncertain:** none  
**No gather steps in this pathway** — all docs unmatched

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Passport or travel document | ✓ | e5a8aa85 | — | unmatched |
| Work experience documentation | ✓ | 704367cf | — | unmatched |
| Language test results | ✓ | 4605a407 | — | unmatched |
| Educational credential assessment | — | 8d2d9e04 | — | unmatched |
| Valid passport | ✓ | 336753fa | — | unmatched (duplicate of e5a8aa85 — two passport rows present) |
| STEM occupation evidence | ✓ | 93a9f49c | — | unmatched |

**Linked:** 0 · **Unmatched:** 6  
**Note:** Two passport-type doc rows exist for this pathway (e5a8aa85 and 336753fa) — possible data duplication worth reviewing.

---

## 7 · Family Sponsorship

`canada-family-sponsorship` · 8 steps · 5 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 29782d20 | Determine eligibility as sponsor | information | **information** | "Determine eligibility" pattern |
| 2 | 1f8838ad | Assess family member eligibility | information | **information** | "Assess eligibility" pattern |
| 3 | d33ca4a4 | Gather required documents | information | **information** | ⚠️ uncertain: generic title; description names proof of income + ID docs but step title has no specific doc name |
| 4 | dc94f32d | Complete sponsorship application forms | information | **information** | ⚠️ uncertain: form completion step; no specific doc gather |
| 5 | b434ef0d | Submit complete application | information | **external_action** | "Submit" to IRCC |
| 6 | 146f47e9 | Wait for application processing | information | **information** | "Wait" pattern |
| 7 | e269c698 | Obtain Quebec undertaking (if applicable) | information | **external_action** | ⚠️ uncertain: "Obtain" here means submitting an application to Quebec's MIFI (provincial portal); is_optional=true |
| 8 | d18356c0 | Receive approval decision | information | **information** | "Receive" pattern |

**Type changes:** 5 → external_action; 7 → external_action (⚠️ uncertain — Quebec MIFI, not IRCC/OINP/BOWP specifically)  
**Uncertain:** steps 3, 4, 7

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Proof of income | ✓ | a4a01682 | — | unmatched (step 3 is uncertain/generic) |
| Financial Evaluation Form (IMM 1283) | — | fa08c0cd | — | unmatched (step 4 is form completion, not gather) |
| Sponsorship agreement undertaking | ✓ | 92c56769 | — | unmatched |
| Identification documents | ✓ | d75f2272 | — | unmatched (step 3 generic) |
| Quebec undertaking application | — | 183e07fa | — | unmatched (step 7 is external_action, not gather) |

**Linked:** 0 · **Unmatched:** 5

---

## 8 · Federal Skilled Trades Program (FSTP)

`canada-fstp` · 8 steps · 9 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 8c956a55 | Determine your National Occupational Classification (NOC) | information | **information** | "Determine" pattern |
| 2 | 7b01b905 | Verify minimum work experience requirements | information | **information** | "Verify" pattern |
| 3 | 8eaa4a5c | Obtain job offer or certificate of qualification | information | **document_upload** | "Obtain" + two named docs matching → 🔗; applicant must have one or the other |
| 4 | d98c4ebe | Complete language test requirement | information | **information** | ⚠️ uncertain: taking a test, not portal submission |
| 5 | 6719c3c3 | Gather proof of funds or confirm employment status | information | **document_upload** | "Gather proof of funds" + named doc "Proof of funds" → 🔗; is_optional=true |
| 6 | d7d921d4 | Confirm admissibility to Canada | information | **information** | "Confirm" pattern |
| 7 | 2756875a | Decide where you plan to live in Canada | information | **information** | Decision/planning step |
| 8 | dc9c577e | Create Express Entry profile and submit application | information | **external_action** | ⚠️ uncertain: "submit" profile to Express Entry pool online |

**Type changes:** 3 → document_upload; 5 → document_upload; 8 → external_action (⚠️ uncertain)  
**Uncertain:** steps 4, 8

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Educational credential assessment (ECA) | — | 7d1baa4d | — | unmatched (no "obtain ECA" step in FSTP) |
| Canadian education credential | — | 28c03147 | — | unmatched |
| Language test results | ✓ | 5de84c92 | — | unmatched (step 4 is "complete test") |
| Employment letters | ✓ | a4edfde6 | — | unmatched |
| Certificate of qualification | — | 368acc71 | **8eaa4a5c** (step 3 — Obtain job offer or certificate of qualification) | 🔗 matched |
| Valid job offer | — | 5626a01e | **8eaa4a5c** (step 3 — Obtain job offer or certificate of qualification) | 🔗 matched |
| Proof of funds | — | eddf9202 | **6719c3c3** (step 5 — Gather proof of funds or confirm employment status) | 🔗 matched |
| Police certificate | — | 51dda1a0 | — | unmatched |
| Medical examination | — | ad20ac25 | — | unmatched |

⛔ **No-mandatory flag:** step 3 (document_upload) — both "Certificate of qualification" and "Valid job offer" are is_mandatory=false (applicant needs exactly one of them; neither is universally mandatory).  
⛔ **No-mandatory flag:** step 5 (document_upload) — "Proof of funds" is is_mandatory=false (waived if applicant has a valid Canadian job offer).

**Linked:** 3 docs · **Unmatched:** 6

---

## 9 · Home Child Care Provider & Home Support Worker Pilots

`canada-caregiver` · 6 steps · 2 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 469e99bc | Determine qualifying work experience | information | **information** | "Determine" pattern |
| 2 | 403066ae | Choose application category | information | **information** | Decision step |
| 3 | e5bea886 | Gather required documentation | information | **document_upload** | "Gather" + two named docs both match exactly → 🔗; both mandatory |
| 4 | ab7fbd15 | Create Permanent Residence Portal account | information | **information** | Create account, not submit |
| 5 | 97af1506 | Submit application | information | **external_action** | "Submit" via PR Portal |
| 6 | 4f36aa22 | Submit proof of additional work experience | information | **external_action** | "Submit" to IRCC; is_optional=true (Gaining Experience category only) |

**Type changes:** 3 → document_upload; 5 → external_action; 6 → external_action  
**Uncertain:** none

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Proof of qualifying work experience | ✓ | d73dd837 | **e5bea886** (step 3 — Gather required documentation) | 🔗 matched |
| Work history documentation | ✓ | 4535f261 | **e5bea886** (step 3 — Gather required documentation) | 🔗 matched |

**Linked:** 2 docs · **Unmatched:** 0  
No no-mandatory issues — both linked docs are mandatory.

---

## 10 · Ontario Immigrant Nominee Program (OINP)

`canada-pnp-ontario` · 8 steps · 11 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 50b6bedf | Determine stream eligibility | information | **information** | "Determine" pattern |
| 2 | e02cb27c | Employer submits job offer (if applicable) | information | **information** | ⚠️ uncertain: employer action, not applicant; is_optional=true |
| 3 | ccca9869 | Register expression of interest | information | **external_action** | "Register" via OINP online system |
| 4 | 802e43af | Receive invitation to apply | information | **information** | "Receive" pattern |
| 5 | f87bb494 | Gather required documents | information | **information** | ⚠️ uncertain: generic gather; description lists language test, education, work experience, settlement funds — multiple docs, no single named match in title |
| 6 | b0ddcdad | Submit application to OINP | information | **external_action** | "Submit" via Ontario.ca portal |
| 7 | d1a4504f | Receive provincial nomination decision | information | **information** | "Receive" pattern |
| 8 | 3091f489 | Apply for permanent residence to federal government | information | **external_action** | "Apply" to IRCC via nomination |

**Type changes:** 3 → external_action; 6 → external_action; 8 → external_action  
**Uncertain:** steps 2, 5

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Birth certificate | — | 9446253a | — | unmatched |
| Educational credentials | ✓ | 7393334f | — | unmatched (step 5 generic gather) |
| Work experience documentation | ✓ | 71a46352 | — | unmatched |
| Bank statements and proof of settlement funds | ✓ | e02fca5a | — | unmatched |
| Proof of Ontario residency | ✓ | fc9938d3 | — | unmatched |
| Job offer letter | — | 42dd27f6 | — | unmatched |
| Police certificate | — | af387d6b | — | unmatched |
| Medical examination results | — | 8688e898 | — | unmatched |
| Marriage or partnership certificate | — | 9071fe8e | — | unmatched |
| Passport or travel document | ✓ | b2a4634e | — | unmatched |
| Language test results | ✓ | 38e01331 | — | unmatched |

**Linked:** 0 · **Unmatched:** 11

---

## 11 · Post-Graduation Work Permit (PGWP)

`canada-pgwp` · 8 steps · 5 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | a35e4d6f | Verify graduation from PGWP-eligible designated learning institution | information | **information** | "Verify" pattern |
| 2 | 0906dcf2 | Assess language requirement eligibility | information | **information** | "Assess eligibility" pattern |
| 3 | 946d3f2e | Confirm field of study eligibility (if applicable) | information | **information** | "Confirm" pattern; is_optional=true |
| 4 | bfbea3bb | Gather required documents and supporting evidence | information | **information** | ⚠️ uncertain: generic title; description names study permit, proof of completion, language test, Quebec school letter, authorized leave — multiple named docs, title not specific |
| 5 | 6c0e0a5f | Apply for PGWP within 180 days of completion | information | **external_action** | "Apply" online within 180-day window |
| 6 | 4378a8b8 | Pay PGWP application fee | information | **information** | ⚠️ uncertain: fee payment step; not a doc gather or final application submission |
| 7 | a2ffdbf7 | Wait for PGWP processing and decision | information | **information** | "Wait" pattern |
| 8 | 259fd975 | Receive PGWP and begin work in Canada | information | **information** | "Receive" pattern |

**Type changes:** 5 → external_action  
**Uncertain:** steps 4, 6

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Proof of program completion | ✓ | 7884e900 | — | unmatched (step 4 generic gather) |
| Study permit | ✓ | 22aea109 | — | unmatched |
| Language test results | — | 0d23218f | — | unmatched |
| Official letter from Quebec school | — | bfc63c17 | — | unmatched |
| Proof of authorized leave | — | 9de44751 | — | unmatched |

**Linked:** 0 · **Unmatched:** 5

---

## 12 · Provincial Nominee Program

`provincial-nominee` · 3 steps · 0 docs

Generic/umbrella PNP pathway. No document requirements rows exist.

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 1109bdea | Choose a Province and Stream | information | **information** | Research/decision step |
| 2 | c01c627b | Submit Provincial Application | information | **external_action** | "Submit" to provincial government portal |
| 3 | 74b12ffd | Apply for Permanent Residency | information | **external_action** | "Apply" via Express Entry or paper-based stream |

**Type changes:** 2 → external_action; 3 → external_action  
**Uncertain:** none  
**Docs:** none

---

## 13 · Rural and Northern Immigration Pilot (RNIP)

`canada-rnip` · 6 steps · 0 docs

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | ef0c3445 | Check eligibility requirements | information | **information** | "Check eligibility" pattern |
| 2 | 1f58300f | Find an eligible job | information | **information** | ⚠️ uncertain: employment search, not portal submission or doc gather |
| 3 | 962cf2c0 | Submit community recommendation application | information | **external_action** | "Submit" application to participating community |
| 4 | d5805a60 | Receive community recommendation | information | **information** | "Receive/wait" pattern |
| 5 | 4394c4d7 | Apply for permanent residence | information | **external_action** | "Apply" to IRCC |
| 6 | 10c6cc02 | Apply for work permit (optional) | information | **external_action** | "Apply" for work permit; is_optional=true |

**Type changes:** 3 → external_action; 5 → external_action; 6 → external_action  
**Uncertain:** step 2  
**Docs:** none

---

## 14 · Start-up Visa Program

`canada-startup-visa` · 8 steps · 13 docs  
**Confirmed:** 8 steps retrieved (previously reported as 1) ✓

### Steps

| # | Step ID | Title | Current | Proposed | Note |
|---|---------|-------|---------|----------|------|
| 1 | 01e8bf2b | Obtain letter of support from designated organization | information | **document_upload** | "Obtain" + named doc "Letter of support from designated organization" → 🔗; mandatory |
| 2 | 2bbabf73 | Verify language proficiency requirement | information | **information** | "Verify" pattern |
| 3 | db205edb | Gather and prepare all required documents | information | **information** | ⚠️ uncertain: generic gather; description names 7 distinct docs (passport, language test, letter of support, birth certs, identity docs, police cert, settlement funds) — no single named doc in title |
| 4 | fa355689 | Create account and access PR Portal | information | **information** | Account creation, not submission |
| 5 | 83d08a86 | Complete and upload application forms and documents | information | **information** | ⚠️ uncertain: "upload" suggests document_upload but refers to completing 4 IMM application forms (0008, 5669, 5406, 5562) not directly named in doc_requirements rows |
| 6 | 2d312b83 | Pay application fees online | information | **information** | ⚠️ uncertain: fee payment step; not a doc gather or PR application submission |
| 7 | 19afe247 | Submit application through PR Portal | information | **external_action** | "Submit" via PR Portal |
| 8 | 36d11947 | Respond to completeness check and requests for missing documents | information | **information** | ⚠️ uncertain: reactive/conditional step; is_optional=true |

**Type changes:** 1 → document_upload; 7 → external_action  
**Uncertain:** steps 3, 5, 6, 8

### Documents

| Doc name | mandatory | Doc ID | Proposed step_id | Match status |
|---------- |-----------|--------|-----------------|-------------|
| Valid passport or travel document | ✓ | fd0f1d67 | — | unmatched (step 3 generic gather) |
| Language proficiency test results | ✓ | 6773902a | — | unmatched |
| Letter of support from designated organization | ✓ | 97fcae4e | **01e8bf2b** (step 1 — Obtain letter of support) | 🔗 matched |
| Birth certificate | ✓ | c58b5b43 | — | unmatched |
| Identity and civil status documents | ✓ | 14e34638 | — | unmatched |
| Police certificate | ✓ | 01abe4b0 | — | unmatched |
| Proof of settlement funds | ✓ | 042ef04d | — | unmatched |
| Photographs | ✓ | 1626b86c | — | unmatched |
| Fee payment receipt | ✓ | 9176381c | — | unmatched |
| Statutory Declaration of Common-law Union (IMM 5409) | — | fe8ad122 | — | unmatched |
| Separation Declaration for Minors (IMM 5604) | — | eb1c72c8 | — | unmatched |
| Use of a Representative (IMM 5476) | — | 93fe8789 | — | unmatched |
| Authority to Release Personal Information (IMM 5475) | — | b2d75919 | — | unmatched |

**Linked:** 1 doc · **Unmatched:** 12

---

## Summary

### Row counts

| Pathway | slug | Steps | Docs |
|---------|------|-------|------|
| Atlantic Immigration Program (AIP) | canada-atlantic-immigration | 8 | 8 |
| Bridging Open Work Permit (BOWP) | canada-bowp | 7 | 6 |
| Canadian Experience Class (CEC) | canada-cec | 11 | 10 |
| Express Entry | express-entry | 5 | 0 |
| Express Entry – Federal Skilled Worker | canada-express-entry-fsw | 12 | 11 |
| Express Entry – STEM Category Draw | canada-express-entry-stem | 9 | 6 |
| Family Sponsorship | canada-family-sponsorship | 8 | 5 |
| Federal Skilled Trades Program (FSTP) | canada-fstp | 8 | 9 |
| Home Child Care Provider Pilots | canada-caregiver | 6 | 2 |
| Ontario Immigrant Nominee Program (OINP) | canada-pnp-ontario | 8 | 11 |
| Post-Graduation Work Permit (PGWP) | canada-pgwp | 8 | 5 |
| Provincial Nominee Program | provincial-nominee | 3 | 0 |
| Rural and Northern Immigration Pilot (RNIP) | canada-rnip | 6 | 0 |
| Start-up Visa Program | canada-startup-visa | 8 | 13 |
| **Total** | | **107** | **86** |

AAIP: 0 steps, 0 docs ✓ (excluded — content authoring task)  
BC PNP: 0 steps, 0 docs ✓ (excluded — content authoring task)

### Type changes proposed

#### information → document_upload (8 steps)

| Pathway | Step # | Step ID | Step title |
|---------|--------|---------|-----------|
| AIP | 3 | f955e3b3 | Develop settlement plan with service provider |
| CEC | 4 | 94dd6341 | Gather educational credentials (if applicable) |
| FSW | 4 | 131d2857 | Obtain Educational Credential Assessment if applicable |
| FSW | 6 | 5c93acd5 | Gather proof of funds if required |
| FSTP | 3 | 8eaa4a5c | Obtain job offer or certificate of qualification |
| FSTP | 5 | 6719c3c3 | Gather proof of funds or confirm employment status |
| Caregiver | 3 | e5bea886 | Gather required documentation |
| Startup | 1 | 01e8bf2b | Obtain letter of support from designated organization |

#### information → external_action (22 steps, 4 of which are ⚠️ uncertain)

| Pathway | Step # | Step ID | Step title | Uncertain? |
|---------|--------|---------|-----------|------------|
| AIP | 6 | ebd2b6fc | Apply for work permit (if required) | |
| AIP | 7 | 65e9e23d | Submit permanent residence application to IRCC | |
| BOWP | 6 | dbf435ad | Submit BOWP application online | |
| CEC | 8 | 27b7025d | Submit application after Invitation to Apply | |
| Express Entry | 5 | 86fb5100 | Submit Permanent Residency Application | |
| FSW | 7 | 03cd6725 | Create and submit Express Entry profile | ⚠️ |
| FSW | 9 | 013d8023 | Submit e-APR within 60 days | |
| STEM | 8 | 477500dd | Submit permanent residence application | |
| Family Sponsorship | 5 | b434ef0d | Submit complete application | |
| Family Sponsorship | 7 | e269c698 | Obtain Quebec undertaking (if applicable) | ⚠️ |
| FSTP | 8 | dc9c577e | Create Express Entry profile and submit application | ⚠️ |
| Caregiver | 5 | 97af1506 | Submit application | |
| Caregiver | 6 | 4f36aa22 | Submit proof of additional work experience | |
| OINP | 3 | ccca9869 | Register expression of interest | |
| OINP | 6 | b0ddcdad | Submit application to OINP | |
| OINP | 8 | 3091f489 | Apply for permanent residence to federal government | |
| PGWP | 5 | 6c0e0a5f | Apply for PGWP within 180 days of completion | |
| Provincial Nominee | 2 | c01c627b | Submit Provincial Application | |
| Provincial Nominee | 3 | 74b12ffd | Apply for Permanent Residency | |
| RNIP | 3 | 962cf2c0 | Submit community recommendation application | |
| RNIP | 5 | 4394c4d7 | Apply for permanent residence | |
| RNIP | 6 | 10c6cc02 | Apply for work permit (optional) | ⚠️ |

### Step_id links proposed (11 doc → step assignments)

| Doc name | Doc ID | Step ID | Step title |
|---------- |--------|---------|-----------|
| Settlement plan (AIP) | d8f61d7e | f955e3b3 | Develop settlement plan |
| ECA report (CEC) | 91ebdfef | 94dd6341 | Gather educational credentials |
| Canadian education credential (CEC) | 1c5313f7 | 94dd6341 | Gather educational credentials |
| Educational Credential Assessment report (FSW) | 706471f4 | 131d2857 | Obtain ECA if applicable |
| Proof of funds (FSW) | 8ace1509 | 5c93acd5 | Gather proof of funds if required |
| Certificate of qualification (FSTP) | 368acc71 | 8eaa4a5c | Obtain job offer or certificate of qualification |
| Valid job offer (FSTP) | 5626a01e | 8eaa4a5c | Obtain job offer or certificate of qualification |
| Proof of funds (FSTP) | eddf9202 | 6719c3c3 | Gather proof of funds or confirm employment status |
| Proof of qualifying work experience (Caregiver) | d73dd837 | e5bea886 | Gather required documentation |
| Work history documentation (Caregiver) | 4535f261 | e5bea886 | Gather required documentation |
| Letter of support (Startup) | 97fcae4e | 01e8bf2b | Obtain letter of support |

### Uncertain step classifications (29 steps kept as information)

| Pathway | Step # | Step ID | Step title | Reason |
|---------|--------|---------|-----------|--------|
| AIP | 1 | 77dfa779 | Determine eligibility and gather required documents | Compound step; no single named doc |
| AIP | 2 | d8537f5e | Secure job offer from designated employer | Employment search, not portal or gather |
| AIP | 4 | 4c0d73cf | Employer submits endorsement application | Employer action |
| BOWP | 3 | 995f8c40 | Gather required documents | Generic gather with 5+ named docs |
| BOWP | 4 | 1d223fcf | Prepare work permit extension application | Preparation step, not portal submission |
| BOWP | 5 | 8d543dde | Calculate and prepare fees | Fee calculation, not gather or submit |
| CEC | 3 | 09beead0 | Take and pass approved language tests | Physical test, not IRCC portal submission |
| CEC | 9 | 64409e48 | Complete biometrics | In-person VAC appointment |
| CEC | 10 | ddf73cc0 | Complete medical exam | In-person panel physician appointment |
| Express Entry | 1 | 6c4cdf5d | Educational Credential Assessment | Action (getting ECA done), no doc rows to link |
| Express Entry | 2 | b3527953 | Language Testing | Physical test, not IRCC portal submission |
| FSW | 3 | eea32e84 | Take approved language tests | Physical test |
| FSW | 7 | 03cd6725 | Create and submit Express Entry profile | Pool profile submission, not final PR application |
| FSW | 10 | 674e5c91 | Complete biometrics | In-person VAC |
| FSW | 11 | e22ff223 | Complete medical exam | In-person physician |
| Family Sponsorship | 3 | d33ca4a4 | Gather required documents | Generic gather, title has no named doc |
| Family Sponsorship | 4 | dc94f32d | Complete sponsorship application forms | Form completion, not gather |
| Family Sponsorship | 7 | e269c698 | Obtain Quebec undertaking (if applicable) | Classified external_action but non-standard: Quebec MIFI not IRCC/OINP/BOWP |
| FSTP | 4 | d98c4ebe | Complete language test requirement | Physical test |
| FSTP | 8 | dc9c577e | Create Express Entry profile and submit application | Pool submission, same pattern as FSW step 7 |
| OINP | 2 | e02cb27c | Employer submits job offer (if applicable) | Employer action |
| OINP | 5 | f87bb494 | Gather required documents | Generic gather, title has no named doc |
| PGWP | 4 | bfbea3bb | Gather required documents and supporting evidence | Generic gather, title has no named doc |
| PGWP | 6 | 4378a8b8 | Pay PGWP application fee | Fee payment step |
| RNIP | 2 | 1f58300f | Find an eligible job | Employment search |
| Startup | 3 | db205edb | Gather and prepare all required documents | Generic gather, 7+ named docs in description |
| Startup | 5 | 83d08a86 | Complete and upload application forms and documents | Upload of IMM forms not named in doc_requirements |
| Startup | 6 | 2d312b83 | Pay application fees online | Fee payment step |
| Startup | 8 | 36d11947 | Respond to completeness check and requests for missing documents | Reactive/conditional; is_optional=true |

### Unmatched documents

75 of 86 docs have no confident step match.  
Primary reasons:
1. **No gather step** — many pathways only have eligibility, submit, and wait steps; docs float without an anchor
2. **Generic gather steps** — 8 steps titled "Gather required documents" with no named doc in the title; all their docs left unmatched
3. **Docs gathered implicitly at submission** — passports, police certificates, medical exam results, photos uploaded at the e-APR / portal submit step (which is external_action, not document_upload)

### Document_upload steps with no mandatory doc linkable (⛔)

| Pathway | Step # | Step ID | Step title | Linked docs | All optional? |
|---------|--------|---------|-----------|-------------|---------------|
| CEC | 4 | 94dd6341 | Gather educational credentials | ECA report (—), Canadian credential (—) | Yes — both non-mandatory; step only required when claiming education points |
| FSW | 4 | 131d2857 | Obtain ECA if applicable | ECA report (—) | Yes — non-mandatory; conditional on foreign education |
| FSTP | 3 | 8eaa4a5c | Obtain job offer or certificate of qualification | Cert of qual (—), valid job offer (—) | Yes — each is optional individually; applicant must supply one of the two |
| FSTP | 5 | 6719c3c3 | Gather proof of funds | Proof of funds (—) | Yes — waived if valid Canadian job offer exists |

All four are genuinely optional/conditional by program rules, not data errors.

### Additional data note

**STEM passport duplication:** `canada-express-entry-stem` has two passport-type doc_requirements rows — `e5a8aa85` ("Passport or travel document") and `336753fa` ("Valid passport") — both unlinked. This is likely a duplicate and may warrant review before linking.

---

*Audit complete — 14 pathways written. Awaiting review before any SQL migration.*
