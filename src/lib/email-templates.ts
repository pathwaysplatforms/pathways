/** Context object used to resolve {{PLACEHOLDER}} values in email templates. */
export interface TemplateContext {
  fullName?: string | null;
  occupation?: string | null;
  degreeLevel?: string | null;
  degreeField?: string | null;
  nationality?: string | null;
}

export interface EmailTemplate {
  subject: string;
  /** Short hint shown above the template body, e.g. "Send to your employer's HR department." */
  recipientHint: string;
  body: string;
}

/** Keyed by pathway slug → step number → array of templates. */
const TEMPLATES: Record<string, Record<number, EmailTemplate[]>> = {
  'express-entry': {
    1: [
      {
        subject: 'Educational Credential Assessment — Status Inquiry',
        recipientHint: 'Send to your ECA body (WES, ICAS, IQAS, etc.)',
        body: `Dear Assessment Team,

I am writing to inquire about the status of my Educational Credential Assessment application.

Applicant name: {{FULL_NAME}}
Country of education: {{COUNTRY_OF_EDUCATION}}
Degree: {{DEGREE_LEVEL}} in {{DEGREE_FIELD}}
Reference number: {{ECA_REFERENCE_NUMBER}}

I submitted my application on {{SUBMISSION_DATE}} and would appreciate an update on the current processing status and expected completion date.

Thank you for your assistance.

Sincerely,
{{FULL_NAME}}`,
      },
    ],
    2: [
      {
        subject: 'Language Test Score Report Request',
        recipientHint: 'Send to your IELTS or CELPIP test centre',
        body: `Dear Test Centre Team,

I am writing to request a copy of my language test score report for Canadian immigration purposes.

Name: {{FULL_NAME}}
Test taken: {{LANGUAGE_TEST_NAME}}
Test date: {{TEST_DATE}}
Candidate ID: {{CANDIDATE_ID}}

Please confirm whether the results have been submitted to IRCC and provide a timeline for delivery if they have not yet been sent.

Thank you for your help.

Regards,
{{FULL_NAME}}`,
      },
    ],
    5: [
      {
        subject: 'Employment Reference Letter Request',
        recipientHint: "Send to your employer's HR department or direct manager",
        body: `Dear {{MANAGER_NAME}},

I am currently preparing my Permanent Residency application for Canada under the Express Entry program and require a formal employment reference letter.

The letter should include:

- My full name: {{FULL_NAME}}
- Job title: {{OCCUPATION}}
- Employment start date
- Weekly hours worked
- Annual salary
- Brief description of duties

This is a standard requirement for Canadian immigration purposes. Please let me know if you need any additional information from me.

Thank you very much for your support.

Best regards,
{{FULL_NAME}}`,
      },
    ],
  },
  'provincial-nominee': {
    2: [
      {
        subject: 'Provincial Nomination Application — Status Request',
        recipientHint: 'Send to your provincial immigration office',
        body: `Dear Provincial Immigration Team,

I am writing to follow up on my Provincial Nominee Program (PNP) application.

Applicant name: {{FULL_NAME}}
Nationality: {{NATIONALITY}}
Stream applied under: {{PNP_STREAM_NAME}}
Application reference number: {{PNP_REFERENCE_NUMBER}}
Date of submission: {{SUBMISSION_DATE}}

Could you please advise on the current status of my application and an estimated processing timeline?

Thank you for your time.

Sincerely,
{{FULL_NAME}}`,
      },
    ],
  },
  'pgwp': {
    2: [
      {
        subject: 'Post-Graduation Work Permit Application — Document Query',
        recipientHint: 'Send to IRCC via the webform at canada.ca',
        body: `Dear IRCC Officer,

I am writing regarding my Post-Graduation Work Permit application.

Applicant name: {{FULL_NAME}}
Application number: {{IRCC_APPLICATION_NUMBER}}
Date of graduation: {{GRADUATION_DATE}}
Institution: {{INSTITUTION_NAME}}

I would like to confirm that all required documents have been received and whether any additional information is needed to process my application.

Thank you for your assistance.

Regards,
{{FULL_NAME}}`,
      },
    ],
  },
};

/**
 * Returns email templates for the given pathway slug and step number.
 * Returns an empty array when no templates are defined for that combination.
 */
export function getEmailTemplates(
  pathwaySlug: string,
  stepNumber: number
): EmailTemplate[] {
  return TEMPLATES[pathwaySlug]?.[stepNumber] ?? [];
}

/**
 * Replaces known {{PLACEHOLDER}} tokens in a template string with values
 * from the provided context. Unknown placeholders are left as-is so the
 * user can fill them in manually.
 */
export function resolveTemplate(
  template: string,
  context: TemplateContext
): string {
  const replacements: Record<string, string> = {};

  if (context.fullName) replacements['FULL_NAME'] = context.fullName;
  if (context.occupation) replacements['OCCUPATION'] = context.occupation;
  if (context.degreeLevel) replacements['DEGREE_LEVEL'] = context.degreeLevel;
  if (context.degreeField) replacements['DEGREE_FIELD'] = context.degreeField;
  if (context.nationality) replacements['NATIONALITY'] = context.nationality;

  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
    return replacements[key] ?? match;
  });
}
