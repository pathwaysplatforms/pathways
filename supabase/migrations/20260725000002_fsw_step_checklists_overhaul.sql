-- Overhaul checklist_items for all canada-express-entry-fsw pathway steps.
--
-- Rationale:
--   Old format: plain string arrays — trivial, repetitive sub-tasks with no guidance.
--   New format: rich JSONB objects — { label, detail, links[], tips[] }
--   Each step now has 1-3 action-only tasks. The expanded drawer shows instructions,
--   official IRCC links, and practical tips. String-format rows in other pathways
--   remain untouched — the parser handles both formats.
--
-- Depends on: 20260725000001 (step 5 removed, steps 6-12 → 5-11 for this pathway).
-- Pathway UUID: 7214d890-a0c9-44d7-901d-b363e7fdd323 (canada-express-entry-fsw)

-- ── Step 1: Find your National Occupational Classification (NOC) ──────────────
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Identify your NOC code",
    "detail": "Search the NOC database using your job title, then confirm the lead statement and at least most of the main duties listed match your actual work. Your NOC code is central to your FSW application — it defines which work experience counts and at what skill level.",
    "links": [
      { "label": "Search the NOC database", "url": "https://noc.esdc.gc.ca/Structure/NocProfile" },
      { "label": "IRCC guide: finding your NOC", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/find-national-occupation-code.html" }
    ],
    "tips": [
      "If you have held multiple jobs, identify the NOC for each and choose the one where you have the most continuous qualifying experience.",
      "The lead statement is the most important match — if it does not describe your role, keep searching."
    ]
  },
  {
    "label": "Confirm your NOC qualifies for FSW (TEER 0–3)",
    "detail": "Federal Skilled Worker only accepts experience in TEER 0, 1, 2, or 3 occupations. TEER 4 and 5 do not qualify. Check your NOC entry on the NOC website to see its TEER level listed at the top of the page.",
    "links": [
      { "label": "NOC TEER level explanation", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/find-national-occupation-code.html" }
    ],
    "tips": [
      "Most professional, managerial, technical, and skilled trades roles fall within TEER 0–3."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 1;

-- ── Step 2: Gather and verify skilled work experience ────────────────────────
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Collect employer reference letters for each qualifying job",
    "detail": "Request a reference letter from each employer on company letterhead, signed by your manager or HR. Each letter must include your job title, duties aligned with your NOC lead statement, start and end dates, weekly hours, and salary or hourly wage. Self-employment requires supporting documents such as contracts, invoices, and business registration.",
    "links": [
      { "label": "IRCC reference letter requirements", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/reference-letter.html" }
    ],
    "tips": [
      "Letters do not need to mention Express Entry — they simply need to document your role, duties, and compensation in detail.",
      "If a former employer is unresponsive, pay stubs, T4s, and a statutory declaration may be accepted as supplementary evidence."
    ]
  },
  {
    "label": "Verify you meet the minimum: 1 year of continuous paid skilled work",
    "detail": "FSW requires at least 1,560 hours (roughly 30 hrs/week × 52 weeks) of paid skilled work in a single TEER 0–3 NOC within the last 10 years. Part-time hours count proportionally. Multiple employers in the same NOC can be combined as long as the work was continuous with no significant gaps.",
    "links": [
      { "label": "FSW work experience requirements", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-workers.html" }
    ],
    "tips": [
      "Volunteer work and unpaid internships do not count — only paid employment qualifies.",
      "Self-employed work qualifies if you can document it with contracts, client invoices, and bank statements."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 2;

-- ── Step 3: Take approved language tests ─────────────────────────────────────
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Book and sit an IRCC-approved language test",
    "detail": "For English, book IELTS General Training or CELPIP-General. For French, book TEF Canada or TCF Canada. FSW requires a minimum of CLB 7 in all four abilities (reading, writing, speaking, listening). Scores are valid for two years from the test date.",
    "links": [
      { "label": "Book IELTS General Training", "url": "https://www.ielts.org/book-a-test" },
      { "label": "Book CELPIP-General", "url": "https://www.celpip.ca/take-celpip/register/" },
      { "label": "Book TEF Canada", "url": "https://www.lefrancaisdesaffaires.fr/tef/" },
      { "label": "Approved language tests for Express Entry", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-requirements/language-testing.html" }
    ],
    "tips": [
      "CELPIP is only available in Canada. If you are outside Canada, IELTS General Training is your English option.",
      "Book early — test centres in major cities fill up weeks in advance, especially before draw seasons."
    ]
  },
  {
    "label": "Receive your official score report",
    "detail": "IELTS results are available in approximately 13 days; CELPIP results in 8 business days. Download your official score report and note your TRF number (IELTS) or order number (CELPIP) — you will enter this when adding language results to your Express Entry profile.",
    "links": [
      { "label": "CLB to IELTS score equivalency chart", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/standard-requirements/language-requirements/test-equivalency-charts.html" }
    ],
    "tips": [
      "Do not wait for test results before gathering other documents — language testing often takes weeks and should be booked as early as possible."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 3;

-- ── Step 4: Obtain Educational Credential Assessment (ECA) ───────────────────
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Apply for your ECA through a designated organization",
    "detail": "If you studied outside Canada, apply for an Educational Credential Assessment (ECA) through one of IRCC''s designated organizations. World Education Services (WES) is the most widely used. Apply online and arrange for your university to send official transcripts directly to the ECA body. WES processing typically takes 7–12 weeks.",
    "links": [
      { "label": "Apply for ECA with WES", "url": "https://www.wes.org/ca/" },
      { "label": "All IRCC-designated ECA organizations", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/educational-credentials/get-assessed.html" }
    ],
    "tips": [
      "Order extra official transcripts from your university — most ECA organizations require transcripts sent directly from the institution and do not return originals.",
      "WES offers a document-by-document evaluation for Express Entry. Make sure you select the correct assessment type during the application."
    ]
  },
  {
    "label": "Retrieve your ECA report and reference number",
    "detail": "Once your assessment is complete, download your ECA report and note your reference number. You will enter this number directly into your Express Entry profile. Confirm that the report shows your credential assessed at the Canadian equivalent level.",
    "links": [
      { "label": "Check your WES application status", "url": "https://www.wes.org/applicants/" }
    ],
    "tips": [
      "ECA reports for Express Entry are valid for 5 years from the date of assessment. You can reuse the same report for a second application within that window."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 4;

-- ── Step 5: Gather proof of settlement funds ─────────────────────────────────
-- (was step 6 before 20260725000001 renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Calculate the minimum funds required for your family size",
    "detail": "IRCC requires proof of accessible funds to support yourself and any accompanying family members on arrival. Current minimums: 1 person $13,757 CAD · 2 people $17,127 · 3 people $21,055 · 4 people $25,564 · 5 people $29,002. These amounts are updated annually — always verify on the IRCC website.",
    "links": [
      { "label": "IRCC proof of funds requirements and current amounts", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html" }
    ],
    "tips": [
      "Funds must be liquid and accessible — fixed-term deposits that cannot be withdrawn before maturity do not count.",
      "You do not need proof of funds if you have a valid job offer in Canada from an employer who has an LMIA, or if you are currently authorized to work in Canada."
    ]
  },
  {
    "label": "Obtain official bank letters or 6 months of statements",
    "detail": "Request official letters from your bank on letterhead, showing your name, account number, current balance, and the date. Alternatively, provide 6 months of statements for each account. If your funds are in multiple currencies, include a note showing the CAD equivalent using the current exchange rate.",
    "links": [
      { "label": "Acceptable documents for proof of funds", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html" }
    ],
    "tips": [
      "If your funds are split across multiple banks or countries, gather documentation for all accounts and prepare a clear summary sheet."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 5;

-- ── Step 6: Create Express Entry profile ─────────────────────────────────────
-- (was step 7 before renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Create your IRCC secure online account",
    "detail": "Register for an IRCC account at the portal below. This is where you will create and manage your Express Entry profile, receive your Invitation to Apply, and submit your permanent residence application. Use your legal name exactly as it appears on your passport.",
    "links": [
      { "label": "Create your IRCC account", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/account.html" }
    ],
    "tips": [
      "Write down your username, password, and security questions immediately. Account recovery can take days and will stall your application."
    ]
  },
  {
    "label": "Complete and submit your Express Entry profile",
    "detail": "Fill in your personal information, work experience, education, language scores, and any job offers or provincial nominations. Review everything carefully before submitting — your profile is active for 12 months and can be updated at any time before you receive an ITA.",
    "links": [
      { "label": "Express Entry profile guide", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence/express-entry-profile.html" },
      { "label": "Express Entry eligibility tool", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool.html" }
    ],
    "tips": [
      "Double-check all language scores and dates against your official test results. Errors or misrepresentation on your profile can have serious legal consequences."
    ]
  },
  {
    "label": "Record your CRS score and profile number",
    "detail": "After submitting, your Comprehensive Ranking System (CRS) score is calculated and displayed. Note your profile ID and CRS score. Use the IRCC CRS tool to verify the calculation and understand which factors you can improve.",
    "links": [
      { "label": "IRCC CRS calculator", "url": "https://ircc.canada.ca/english/immigrate/skilled/crs-tool.asp" }
    ],
    "tips": [
      "Your CRS score can change if you secure a job offer, improve language scores, or receive a provincial nomination. Update your profile immediately when anything changes — each update is timestamped."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 6;

-- ── Step 7: Wait for Invitation to Apply ─────────────────────────────────────
-- (was step 8 before renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Monitor Express Entry draw results",
    "detail": "IRCC holds invitation rounds roughly every two weeks and publishes the cutoff CRS score and number of invitations issued. Check results after each draw. Only a round where the cutoff reaches or drops below your score results in an invitation.",
    "links": [
      { "label": "Latest Express Entry draw results", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations.html" }
    ],
    "tips": [
      "Sign up for immigration news alerts from CIC News or Moving2Canada to hear about each draw within minutes of it being published."
    ]
  },
  {
    "label": "Strengthen your profile while waiting",
    "detail": "Use the waiting period to improve your CRS score: retake language tests for a higher CLB, secure a valid job offer, or explore Provincial Nominee Programs (PNPs) — a provincial nomination adds 600 CRS points, making an ITA near-certain. Keep your profile updated; an expired profile (12 months old) means losing your place in the pool.",
    "links": [
      { "label": "Provincial nominee programs overview", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees/works.html" },
      { "label": "How to improve your CRS score", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html" }
    ],
    "tips": [
      "Profiles expire after 12 months. If you have not received an ITA before expiry, resubmit your profile immediately — your CRS score and position reset."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 7;

-- ── Step 8: Submit e-APR within 60 days ──────────────────────────────────────
-- (was step 9 before renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Order police certificates and compile all required documents",
    "detail": "You have exactly 60 days from your ITA to submit a complete application — start the same day. Police certificates are the longest lead item: they are required from every country you have lived in for 6 or more months since age 18 and can take several weeks. Also gather: valid passport, language results, ECA report, employer reference letters, proof of funds, and passport-size photos.",
    "links": [
      { "label": "Complete e-APR document checklist", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence.html" },
      { "label": "How to apply for a Canadian police certificate", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/police-certificates.html" }
    ],
    "tips": [
      "For the USA: request an FBI Identity History Summary. For India: apply through the local police or Passport Seva Kendra. Processes vary — research your specific countries early.",
      "Missing even one document causes your application to be deemed incomplete and returned."
    ]
  },
  {
    "label": "Pay fees and submit your permanent residence application",
    "detail": "Log into your IRCC account, upload all documents, and pay the required fees: $1,365 CAD processing fee (principal applicant) plus $500 CAD right of permanent residence fee. Submit before the 60-day deadline — late applications cannot be accepted and your ITA is cancelled.",
    "links": [
      { "label": "IRCC application fees", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/apply-permanent-residence/fees.html" },
      { "label": "Pay IRCC fees online", "url": "https://ircc.canada.ca/english/information/fees/index.asp" }
    ],
    "tips": [
      "Have your credit card ready before starting the upload — IRCC''s portal can time out. Complete the payment and submission in a single session if possible."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 8;

-- ── Step 9: Complete biometrics ───────────────────────────────────────────────
-- (was step 10 before renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Give fingerprints and photo at a Visa Application Centre",
    "detail": "After submitting your e-APR, IRCC will send a Biometric Instruction Letter (BIL) to your IRCC account. Book an appointment at your nearest Visa Application Centre (VAC) or, if you are in the USA, an Application Support Center (ASC). Bring your BIL and valid passport. Biometrics are valid for 10 years.",
    "links": [
      { "label": "Find a Visa Application Centre near you", "url": "https://www.vfsglobal.ca/canada/en" },
      { "label": "IRCC biometrics overview", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/campaigns/biometrics/how-to-give-biometrics.html" }
    ],
    "tips": [
      "Book your appointment as soon as the BIL arrives — VACs in major cities are often booked several weeks out."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 9;

-- ── Step 10: Complete medical exam ───────────────────────────────────────────
-- (was step 11 before renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Book and attend your immigration medical exam",
    "detail": "IRCC will send medical exam instructions to your account. Find an IRCC-designated panel physician near you and book your appointment. Bring your passport and any existing medical records. The physician sends results directly to IRCC — you do not need to submit anything yourself. Results are valid for 12 months.",
    "links": [
      { "label": "Find an IRCC panel physician", "url": "https://secure.cic.gc.ca/pp-md/pp-list.aspx" },
      { "label": "Immigration medical exam overview", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/medical-police/medical-exams/requirements-permanent-residents.html" }
    ],
    "tips": [
      "Some panel physicians have wait times of several weeks. Book as soon as you receive your medical exam instructions.",
      "Bring your glasses or contact lenses if you wear them — a vision test is included."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 10;

-- ── Step 11: Receive Confirmation of Permanent Residence (COPR) ──────────────
-- (was step 12 before renumbering)
UPDATE public.pathway_steps
SET checklist_items = '[
  {
    "label": "Review your COPR for errors before travel",
    "detail": "IRCC will notify you via your online account when your Confirmation of Permanent Residence (COPR) is ready. Download it and check every field carefully — your name, date of birth, and family member details must match your passport exactly. Report any errors to IRCC immediately and do not travel until they are corrected.",
    "links": [
      { "label": "Understanding your COPR", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/pr-card/understand-pr-status.html" },
      { "label": "Report errors on an immigration document", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-status/update-your-information.html" }
    ],
    "tips": [
      "The expiry date printed on your COPR is your hard deadline — you must land in Canada as a permanent resident before this date or your approval lapses."
    ]
  },
  {
    "label": "Land in Canada and activate your permanent resident status",
    "detail": "Book your travel and arrive in Canada before your COPR expiry date. At the port of entry, present your COPR and valid passport to the Canada Border Services Agency (CBSA) officer. They will verify your identity and confirm your permanent resident status. You may receive a temporary PR card confirmation at some airports.",
    "links": [
      { "label": "What to bring when landing as a new PR", "url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/new-immigrants/pr-card/understand-pr-status.html" }
    ],
    "tips": [
      "Bring printed copies of all your immigration documents when landing, even if you applied online.",
      "Have your Canadian address ready — the border officer will ask where you will be living."
    ]
  }
]'::jsonb
WHERE pathway_id = '7214d890-a0c9-44d7-901d-b363e7fdd323'
  AND step_number = 11;
