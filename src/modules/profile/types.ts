/** All data required to render the Profile tab. */
export interface ProfileTabData {
  id: string;
  avatarInitials: string;
  firstName: string;
  applicationId: string | null;

  fullName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  currentCountry: string | null;
  maritalStatus: string | null;

  occupation: string | null;
  nocCode: string | null;
  nocTeerCategory: number | null;
  yearsExperience: number | null;
  hasCanadianExperience: boolean | null;

  educationLevel: string | null;
  degreeLevel: string | null;
  degreeField: string | null;
  ecaObtained: boolean | null;

  clbListening: number | null;
  clbReading: number | null;
  clbSpeaking: number | null;
  clbWriting: number | null;
  englishLevel: string | null;

  annualIncome: number | null;
  incomeCurrency: string | null;

  intendedProvince: string | null;
  hasFamilyInCanada: boolean | null;
  hasProvincialNomination: boolean | null;

  canadianWorkYears: number | null;
  foreignWorkYears: number | null;
  canadianWorkRecent: boolean | null;
  foreignWorkRecent: boolean | null;

  spouseComingToCanada: boolean | null;
  spouseEducationLevel: string | null;
  spouseClbListening: number | null;
  spouseClbReading: number | null;
  spouseClbSpeaking: number | null;
  spouseClbWriting: number | null;
  spouseCanadianWorkYears: number | null;

  hasCanadianJobOffer: boolean | null;
  hasSiblingInCanada: boolean | null;

  pathwayInputJson: Record<string, unknown> | null;
  profileCompletenessPct: number | null;
}

/** Editable subset of profile fields exposed in the Profile tab edit form. */
export interface ProfileDraft {
  fullName: string | null;
  nationality: string | null;
  currentCountry: string | null;
  occupation: string | null;
  yearsExperience: number | null;
  educationLevel: string | null;
  degreeField: string | null;
  intendedProvince: string | null;

  clbListening: number | null;
  clbReading: number | null;
  clbSpeaking: number | null;
  clbWriting: number | null;

  nocTeerCategory: number | null;
  nocCode: string | null;

  canadianWorkYears: number | null;
  foreignWorkYears: number | null;
  canadianWorkRecent: boolean | null;
  foreignWorkRecent: boolean | null;

  spouseComingToCanada: boolean | null;
  spouseEducationLevel: string | null;
  spouseClbListening: number | null;
  spouseClbReading: number | null;
  spouseClbSpeaking: number | null;
  spouseClbWriting: number | null;
  spouseCanadianWorkYears: number | null;

  hasCanadianJobOffer: boolean | null;
  hasSiblingInCanada: boolean | null;
  hasCanadianExperience: boolean | null;
  ecaObtained: boolean | null;
  hasProvincialNomination: boolean | null;
  hasFamilyInCanada: boolean | null;
}
