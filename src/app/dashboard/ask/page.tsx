import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { AskPageClient } from '@/components/ask/AskPageClient';

function deriveFirstName(fullName: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] ?? 'there';
}

function deriveAvatarInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/** Server component: authenticates user and renders the Ask Pathways Q&A page. */
export default async function AskPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const db = supabase as unknown as SupabaseClient;
  const { data: profileData } = await db
    .from('profiles')
    .select('full_name')
    .eq('auth_user_id', user.id)
    .single();

  const profile = profileData as { full_name: string | null } | null;
  const fullName = profile?.full_name ?? null;

  return (
    <DashboardShell
      avatarInitials={deriveAvatarInitials(fullName)}
      firstName={deriveFirstName(fullName)}
    >
      <AskPageClient />
    </DashboardShell>
  );
}
