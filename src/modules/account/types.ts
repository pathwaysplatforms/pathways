export type SubscriptionStatus = "guest" | "free" | "paid";

/** Full profile as returned by account queries (includes account-tier columns). */
export type AccountProfile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_language: string;
  phone: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  subscription_status: SubscriptionStatus;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

/** Fields the user may update on their own profile. */
export type UpdateProfileInput = {
  full_name?: string | null;
  avatar_url?: string | null;
  preferred_language?: string;
  phone?: string | null;
  nationality?: string | null;
  country_of_residence?: string | null;
};

/** Row shape for the admin user management table. */
export type AdminUserRow = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  subscription_status: SubscriptionStatus;
  is_admin: boolean;
  created_at: string;
  onboarding_step: string | null;
};

/** Paginated user list returned by listUsers. */
export type AdminUsersResult = {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** Audit event stored for sensitive admin actions. */
export type AuditEvent = {
  action: string;
  target_user_id: string;
  admin_user_id: string;
  details: Record<string, unknown>;
  timestamp: string;
};
