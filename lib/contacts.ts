import { createClient } from '@/lib/supabase/client';
import type { ArchivedContact, CompanySize, Contact, ContactStatus, Sector, Statut } from '@/types/domain';

/** Shape of the form fields (empty string = "not set"). */
export interface ContactInput {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  company: string;
  sector: Sector | '';
  companySize: CompanySize | '';
}

export const EMPTY_CONTACT_INPUT: ContactInput = {
  firstName: '', lastName: '', role: '', email: '', phone: '', company: '', sector: '', companySize: '',
};

type ContactRow = {
  id: string;
  owner_id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  sector: Sector | null;
  company_size: CompanySize | null;
  archived_at: string | null;
  purge_after: string | null;
  created_at: string;
  updated_at: string;
};

function mapContact(r: ContactRow): Contact {
  return {
    id: r.id,
    ownerId: r.owner_id,
    firstName: r.first_name,
    lastName: r.last_name,
    role: r.role,
    email: r.email,
    phone: r.phone,
    company: r.company,
    sector: r.sector,
    companySize: r.company_size,
    archivedAt: r.archived_at,
    purgeAfter: r.purge_after,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const nz = (s: string): string | null => (s.trim() === '' ? null : s.trim());

function toRow(input: ContactInput): Record<string, string | null> {
  return {
    first_name: nz(input.firstName),
    last_name: nz(input.lastName),
    role: nz(input.role),
    email: nz(input.email),
    phone: nz(input.phone),
    company: nz(input.company),
    sector: input.sector === '' ? null : input.sector,
    company_size: input.companySize === '' ? null : input.companySize,
  };
}

/** Convert a loaded Contact back into editable form fields. */
export function contactToInput(c: Contact): ContactInput {
  return {
    firstName: c.firstName ?? '',
    lastName: c.lastName ?? '',
    role: c.role ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    company: c.company ?? '',
    sector: c.sector ?? '',
    companySize: c.companySize ?? '',
  };
}

/** All non-archived contacts (RLS returns every member's rows; scope filters the view client-side). */
export async function listContacts(): Promise<Contact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as ContactRow[] | null ?? []).map(mapContact);
}

/** Non-archived contacts joined with their derived statut (public.contacts_with_status, Spec 1B). */
export async function listContactsWithStatus(): Promise<ContactStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts_with_status')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as (ContactRow & { statut: Statut })[] | null ?? []).map((r) => ({
    ...mapContact(r),
    statut: r.statut,
  }));
}

/** Archived contacts (archived_at not null), soonest-to-purge first. */
export async function listArchivedContacts(): Promise<ArchivedContact[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts_with_status')
    .select('*')
    .not('archived_at', 'is', null)
    .order('purge_after', { ascending: true });
  if (error) throw error;
  return (data as (ContactRow & { statut: Statut })[] | null ?? [])
    .filter((r) => r.archived_at && r.purge_after)
    .map((r) => ({ ...mapContact(r), archivedAt: r.archived_at as string, purgeAfter: r.purge_after as string }));
}

/** A single contact with its derived statut, or null if not found / not readable. */
export async function getContactWithStatus(id: string): Promise<ContactStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts_with_status')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as ContactRow & { statut: Statut };
  return { ...mapContact(r), statut: r.statut };
}

/** Insert a contact owned by the current member (RLS enforces owner_id = auth.uid()). */
export async function createContact(input: ContactInput, ownerId: string): Promise<Contact> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...toRow(input), owner_id: ownerId })
    .select('*')
    .single();
  if (error) throw error;
  return mapContact(data as ContactRow);
}

/** Update a contact (RLS allows only the owner). */
export async function updateContact(id: string, input: ContactInput): Promise<Contact> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('contacts')
    .update(toRow(input))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapContact(data as ContactRow);
}

/** Delete a contact (RLS allows only the owner; archive replaces this in plan 1E). */
export async function deleteContact(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw error;
}

/** Display name for a contact row: full name, else company, else em-dash. */
export function contactDisplayName(c: Contact): string {
  const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return full || c.company || '—';
}
