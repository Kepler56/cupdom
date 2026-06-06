import { createClient } from '@/lib/supabase/client';
import { appendHistory } from '@/lib/history';
import type { ContactLink } from '@/types/domain';

/** Single source for allowed link schemes (Spec 1C §5.8). No javascript:/data:/file:. */
export const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'] as const;

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** Prepend https:// to a bare domain (no scheme); leave scheme'd URLs untouched. */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  return HAS_SCHEME.test(s) ? s : `https://${s}`;
}

/** True only for http/https/mailto/tel; rejects javascript:/data:/file: and unparseable input. */
export function isSafeUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const url = new URL(normalizeUrl(s));
    return (SAFE_URL_SCHEMES as readonly string[]).includes(url.protocol);
  } catch {
    return false;
  }
}

type LinkRow = { id: string; contact_id: string; label: string; url: string; created_at: string };

function mapLink(r: LinkRow): ContactLink {
  return { id: r.id, contactId: r.contact_id, label: r.label, url: r.url, createdAt: r.created_at };
}

export async function listLinks(contactId: string): Promise<ContactLink[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contact_links')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as LinkRow[] | null ?? []).map(mapLink);
}

export async function createLink(input: {
  contactId: string;
  label: string;
  url: string;
}): Promise<ContactLink> {
  if (!isSafeUrl(input.url)) throw new Error('URL non autorisée');
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contact_links')
    .insert({ contact_id: input.contactId, label: input.label.trim(), url: normalizeUrl(input.url) })
    .select('*')
    .single();
  if (error) throw error;
  // Best-effort history append (owner-gated by the same RLS as the link insert).
  await appendHistory(input.contactId, 'link', `${input.label.trim()} ajouté`).catch(() => {});
  return mapLink(data as LinkRow);
}

export async function deleteLink(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('contact_links').delete().eq('id', id);
  if (error) throw error;
}
