'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isAllowedEmail, normalizeEmail } from '@/lib/auth';
import type { Profile } from '@/types/domain';

type Row = { id: string; email: string; display_name: string; color: string };

function toProfile(r: Row): Profile {
  return { id: r.id, email: r.email, displayName: r.display_name, color: r.color };
}

/** Fetch every member profile as an id→Profile map (for owner chips, scope switcher). */
export async function fetchProfileMap(): Promise<Record<string, Profile>> {
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('id, email, display_name, color');
  const map: Record<string, Profile> = {};
  for (const r of (data ?? []) as Row[]) map[r.id] = toProfile(r);
  return map;
}

/** The signed-in member's profile (client hook). null while loading or signed out. */
export function useMember(): { member: Profile | null; loading: boolean } {
  const [member, setMember] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isAllowedEmail(user.email)) {
        if (active) { setMember(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, email, display_name, color')
        .eq('id', user.id)
        .single();
      if (active) {
        setMember(data ? toProfile(data as Row) : null);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return { member, loading };
}

/** All member profiles as a map (client hook), for owner chips / scope switcher. */
export function useProfiles(): { profiles: Record<string, Profile>; loading: boolean } {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchProfileMap().then((map) => {
      if (active) { setProfiles(map); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  return { profiles, loading };
}

/** Sign the current member out and return to the login page. */
export function useSignOut(): () => Promise<void> {
  return useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, []);
}

export { isAllowedEmail, normalizeEmail };
