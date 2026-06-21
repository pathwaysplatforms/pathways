/** Data required to render the Account settings page. */
export interface AccountData {
  email: string;
  lastSignInAt: string | null;
  createdAt: string;
}

/** Structured export of all user-owned data. */
export interface UserExportData {
  exportedAt: string;
  profile: {
    fullName: string | null;
    email: string;
    nationality: string | null;
    currentCountry: string | null;
    dateOfBirth: string | null;
    maritalStatus: string | null;
    occupation: string | null;
    yearsExperience: number | null;
    educationLevel: string | null;
    createdAt: string;
  };
  applications: Array<{
    id: string;
    status: string;
    pathway: string | null;
    createdAt: string;
    documents: Array<{
      id: string;
      filename: string;
      status: string;
      uploadedAt: string;
    }>;
  }>;
}
