import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail, normalizeEmail } from '@/lib/auth';
import type { Profile } from '@/types/domain';

/**
 * The signed-in member, or null if there is no session / the email is not allow-listed.
 *
 * MEMOISED PER REQUEST with React's cache(). getUser() is a network call to the
 * Supabase auth server, and this function had several callers per render —
 * requireMember() in the layout, then getMemberProfile() for the same user.
 * Each one was a separate round-trip, and Netlify runs this in Ohio (CMH)
 * against Supabase in eu-west-1, so each cost a measured ~85 ms of Atlantic
 * crossing.
 *
 * cache() is per-render memoisation, NOT a shared cache: the result never
 * outlives the request, so no member can observe another's session. Do not
 * replace it with a module-level variable, which in a warm serverless container
 * would be shared across requests and leak exactly that.
 */
export const getSessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) return null;
  return { id: user.id, email: normalizeEmail(user.email) };
});

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
