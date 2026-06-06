import { createClient } from '@/lib/supabase/client';
import type { Deal, DealStage } from '@/types/domain';

/** A deal joined to its (non-archived) parent contact, for the Pipeline board. */
export interface ScopeDeal extends Deal {
  ownerId: string;
  company: string | null;
}

/** Form fields for creating/editing a deal. */
export interface DealInput {
  title: string;
  stage: DealStage;
  valueEur: number | null;
  expectedClose: string | null;
}

type DealRow = {
  id: string;
  contact_id: string;
  title: string | null;
  stage: DealStage;
  value_eur: number | null;
  expected_close: string | null;
  created_at: string;
  updated_at: string;
};

function mapDeal(r: DealRow): Deal {
  return {
    id: r.id,
    contactId: r.contact_id,
    title: r.title,
    stage: r.stage,
    valueEur: r.value_eur === null ? null : Number(r.value_eur),
    expectedClose: r.expected_close,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toRow(input: DealInput): Record<string, unknown> {
  return {
    title: input.title.trim() === '' ? null : input.title.trim(),
    stage: input.stage,
    value_eur: input.valueEur,
    expected_close: input.expectedClose,
  };
}

/** Deals for one contact, oldest first. */
export async function listDeals(contactId: string): Promise<Deal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as DealRow[] | null ?? []).map(mapDeal);
}

/** All deals joined to non-archived contacts (scope is applied client-side via scopeFilter). */
export async function listScopeDeals(): Promise<ScopeDeal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('deals')
    .select('*, contacts!inner(owner_id, company, archived_at)')
    .is('contacts.archived_at', null);
  if (error) throw error;
  type Joined = DealRow & { contacts: { owner_id: string; company: string | null } };
  return (data as Joined[] | null ?? []).map((r) => ({
    ...mapDeal(r),
    ownerId: r.contacts.owner_id,
    company: r.contacts.company,
  }));
}

export async function createDeal(contactId: string, input: DealInput): Promise<Deal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('deals')
    .insert({ contact_id: contactId, ...toRow(input) })
    .select('*')
    .single();
  if (error) throw error;
  return mapDeal(data as DealRow);
}

export async function updateDeal(id: string, input: DealInput): Promise<Deal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('deals')
    .update(toRow(input))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapDeal(data as DealRow);
}

/** Quick stage change; the DB trigger logs the deal_stage history row. */
export async function setStage(id: string, stage: DealStage): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('deals').update({ stage }).eq('id', id);
  if (error) throw error;
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('deals').delete().eq('id', id);
  if (error) throw error;
}
