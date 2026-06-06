import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail, normalizeEmail } from '@/lib/auth';
import type { Profile } from '@/types/domain';

/** The signed-in member, or null if there is no session / the email is not allow-listed. */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) return null;
  return { id: user.id, email: normalizeEmail(user.email) };
}

/** Like getSessionUser but redirects to /login when there is no valid member. */
export async function requireMember(): Promise<{ id: string; email: string }> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Load the signed-in member's profile row (display name + colour). */
export async function getMemberProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, email, display_name, color')
    .eq('id', user.id)
    .single();
  if (!data) return null;
  return { id: data.id, email: data.email, displayName: data.display_name, color: data.color };
}
