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
}
