export type EducationLevel =
  | 'less_than_secondary'
  | 'secondary'
  | 'one_year_post_secondary'
  | 'two_year_post_secondary'
  | 'bachelors'
  | 'two_or_more_credentials'
  | 'masters'
  | 'phd'

export type ProgramId = 'fsw' | 'cec' | 'fst'

export type EligibilityResult = {
  program: ProgramId
  eligible: boolean
  reasons: string[]
  missing_criteria: string[]
}

export type CRSBreakdown = {
  core: {
    age: number
    education: number
    first_language: number
    second_language: number
    canadian_work: number
    subtotal: number
  }
  spouse: {
    education: number
    language: number
    canadian_work: number
    subtotal: number
  }
  skill_transferability: {
    education_language: number
    education_canadian_work: number
    foreign_work_language: number
    foreign_work_canadian_work: number
    trade_certificate: number
    subtotal: number
  }
  additional: {
    provincial_nomination: number
    french_skills: number
    canadian_education: number
    sibling: number
    subtotal: number
  }
  total: number
}

export type Competitiveness = 'strong' | 'competitive' | 'below_cutoff'

export type PathwayMatch = {
  pathway_id: string
  program: ProgramId
  name: string
  description: string
  crs_score: number
  crs_breakdown: CRSBreakdown
  recent_cutoff: number
  competitiveness: Competitiveness
  processing_months_estimate: number
  next_steps: string[]
}

export type ScoreImprovementTip = {
  action: string
  points_gain_estimate: number
  difficulty: 'easy' | 'medium' | 'hard'
  timeframe: string
}

export type PathwayEngineResult = {
  user_id: string
  eligibility: EligibilityResult[]
  matches: PathwayMatch[]
  improvement_tips: ScoreImprovementTip[]
  calculated_at: string
  data_completeness_warning: boolean
}
