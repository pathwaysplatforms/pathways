/** A file stored in the user's document vault. */
export interface VaultFile {
  id: string;
  userId: string;
  storagePath: string;
  fileName: string;
  displayName: string | null;
  fileSize: number;
  mimeType: string;
  documentType: string | null;
  uploadedAt: string;
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_USER = 20;

/** Closed vocabulary for document_type labels, matching document_requirements.document_type values. */
export const DOCUMENT_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'academic_transcript',              label: 'Academic transcripts' },
  { value: 'acknowledgement_of_receipt',       label: 'Acknowledgement of receipt (IRCC)' },
  { value: 'approval_in_principle',            label: 'Approval in principle letter' },
  { value: 'atas_certificate',                 label: 'ATAS clearance certificate' },
  { value: 'authorization_form',               label: 'Authority to release information (IMM 5475)' },
  { value: 'authorization_letter',             label: 'Authorization letter (study leave)' },
  { value: 'bank_statement',                   label: 'Bank statements / proof of funds' },
  { value: 'birth_certificate',                label: 'Birth certificate' },
  { value: 'certificate_of_sponsorship',       label: 'Certificate of Sponsorship (UK)' },
  { value: 'completion_letter',                label: 'Proof of program completion' },
  { value: 'confirmation_of_acceptance',       label: 'Confirmation of Acceptance for Studies (CAS)' },
  { value: 'credential_certificate',           label: 'Certificate of qualification (trades)' },
  { value: 'csq',                              label: 'Certificat de sélection du Québec (CSQ)' },
  { value: 'cv',                               label: 'CV / professional profile' },
  { value: 'education_credential',             label: 'Educational credentials (degree / diploma)' },
  { value: 'educational_credential_assessment', label: 'Educational Credential Assessment (ECA) report' },
  { value: 'employment_letter',                label: 'Employment letters / pay stubs' },
  { value: 'employment_reference',             label: 'Employment reference (NOC duties)' },
  { value: 'endorsement_letter',               label: 'Endorsement letter' },
  { value: 'english_language_test',            label: 'English language test results (UK)' },
  { value: 'evidence_portfolio',               label: 'Evidence portfolio (talent / publications)' },
  { value: 'fee_receipt',                      label: 'Fee payment receipt' },
  { value: 'financial_form',                   label: 'Financial Evaluation Form (IMM 1283)' },
  { value: 'identity_document',                label: 'Identity and civil status documents' },
  { value: 'job_offer_letter',                 label: 'Job offer letter' },
  { value: 'language_test',                    label: 'Language test results (IELTS / CELPIP / TEF)' },
  { value: 'letter_of_support',                label: 'Letter of support from designated organization' },
  { value: 'marriage_certificate',             label: 'Marriage or partnership certificate' },
  { value: 'medical_exam',                     label: 'Medical examination results' },
  { value: 'nomination_letter',                label: 'Nomination letter (PNP)' },
  { value: 'passport',                         label: 'Passport / travel document' },
  { value: 'photo',                            label: 'Photographs (IRCC specs)' },
  { value: 'police_certificate',               label: 'Police certificates' },
  { value: 'pr_application_number_letter',     label: 'PR application number letter' },
  { value: 'provincial_nomination_letter',     label: 'Provincial nomination / endorsement certificate' },
  { value: 'representative_form',              label: 'Use of a Representative (IMM 5476)' },
  { value: 'residency_proof',                  label: 'Proof of residency' },
  { value: 'school_letter',                    label: 'Official letter from school (Quebec)' },
  { value: 'separation_declaration',           label: 'Separation Declaration for Minors (IMM 5604)' },
  { value: 'settlement_plan',                  label: 'Settlement plan (AIP)' },
  { value: 'statutory_declaration',            label: 'Statutory Declaration of Common-law Union (IMM 5409)' },
  { value: 'study_permit',                     label: 'Study permit' },
  { value: 'supporting_documents',             label: 'Supporting documents (BOWP checklist)' },
  { value: 'tuberculosis_test',                label: 'Tuberculosis (TB) test results' },
  { value: 'undertaking',                      label: 'Sponsorship undertaking agreement' },
];

/** Fast lookup: document_type value → human-readable label. */
export const DOCUMENT_TYPE_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  DOCUMENT_TYPE_OPTIONS.map(({ value, label }) => [value, label])
);
