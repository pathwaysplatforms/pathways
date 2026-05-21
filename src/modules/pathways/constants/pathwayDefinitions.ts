import type { ProgramId } from '../types'

export type PathwayDefinition = {
  id: string
  program: ProgramId
  name: string
  description: string
  processing_months_estimate: number
  target_audience: string
  next_steps: string[]
}

export const PATHWAY_DEFINITIONS: PathwayDefinition[] = [
  {
    id: 'ca_express_entry_fsw',
    program: 'fsw',
    name: 'Express Entry — Federal Skilled Worker',
    description: 'For internationally trained professionals with foreign work experience seeking Canadian permanent residence.',
    processing_months_estimate: 6,
    target_audience: 'Skilled workers outside Canada with 1+ years of foreign skilled work experience',
    next_steps: [
      'Obtain an Educational Credential Assessment (ECA) if your degree is from outside Canada',
      'Take an approved language test (IELTS or CELPIP for English, TEF Canada or TCF Canada for French)',
      'Create your Express Entry profile on the IRCC website',
      'Enter the Express Entry pool and wait for an Invitation to Apply (ITA)',
      'Submit your permanent residence application within 90 days of receiving your ITA',
    ],
  },
  {
    id: 'ca_express_entry_cec',
    program: 'cec',
    name: 'Express Entry — Canadian Experience Class',
    description: 'For skilled workers with recent Canadian work experience seeking permanent residence.',
    processing_months_estimate: 6,
    target_audience: 'Workers in Canada with 1+ years of recent skilled Canadian work experience',
    next_steps: [
      'Confirm your occupation qualifies under NOC TEER 0, 1, 2, or 3',
      'Ensure your language test results are less than 2 years old',
      'Create your Express Entry profile on the IRCC website',
      'Enter the pool and wait for an Invitation to Apply (ITA)',
      'Submit your permanent residence application within 90 days of your ITA',
    ],
  },
  {
    id: 'ca_express_entry_fst',
    program: 'fst',
    name: 'Express Entry — Federal Skilled Trades',
    description: 'For workers with experience in designated skilled trade occupations.',
    processing_months_estimate: 6,
    target_audience: 'Tradespeople with 2+ years in a designated trade and a job offer or trade certificate',
    next_steps: [
      'Confirm your occupation is on the designated trades list',
      'Obtain a valid Canadian job offer OR a provincial/territorial certificate of qualification',
      'Take an approved language test',
      'Create your Express Entry profile on the IRCC website',
      'Submit your PR application within 90 days of your ITA',
    ],
  },
]
