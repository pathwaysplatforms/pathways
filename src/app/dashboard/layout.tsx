import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import type { SubscriptionStatus } from '@/modules/account/types';

function deriveInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function deriveFirstName(fullName: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] ?? 'there';
}

/** Shared layout for all /dashboard routes — authenticates, fetches profile once, renders DashboardShell. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const db = supabase as unknown as SupabaseClient;
  const { data: profileData } = await db
    .from('profiles')
    .select('full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const profile = profileData as { full_name: string | null } | null;

  const validStatuses: SubscriptionStatus[] = ['guest', 'free', 'paid'];
  const rawStatus = user.app_metadata?.subscription_status as string | undefined;
  const subscriptionStatus: SubscriptionStatus =
    validStatuses.includes(rawStatus as SubscriptionStatus) ? (rawStatus as SubscriptionStatus) : 'free';

  return (
    <DashboardShell
      avatarInitials={deriveInitials(profile?.full_name ?? null)}
      firstName={deriveFirstName(profile?.full_name ?? null)}
      subscriptionStatus={subscriptionStatus}
    >
      {children}
    </DashboardShell>
  );
}
