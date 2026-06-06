import type { Deal, DealStage, Statut } from '@/types/domain';

/** Tag tones (mirrors the Tag atom's `tone` prop). */
export type StatutTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

/**
 * Pure mirror of the public.contacts_with_status SQL view (same first-match order).
 * Used for optimistic UI before a refetch. MUST stay in sync with 0002_deals.sql.
 */
export function deriveStatut(deals: Pick<Deal, 'stage'>[]): Statut {
  if (deals.some((d) => d.stage === 'GAGNÉ')) return 'Client';
  if (deals.some((d) => d.stage === 'QUALIFICATION' || d.stage === 'PROPOSITION' || d.stage === 'NÉGOCIATION')) {
    return 'En cours';
  }
  if (deals.length > 0) return 'Perdu';
  return 'Prospect';
}

export const STATUT_TONE: Record<Statut, StatutTone> = {
  Prospect: 'neutral',
  'En cours': 'info',
  Client: 'success',
  Perdu: 'danger',
};

/** Tone for a single deal stage's badge (used by DealCard). */
export const STAGE_TONE: Record<DealStage, StatutTone> = {
  QUALIFICATION: 'info',
  PROPOSITION: 'warning',
  NÉGOCIATION: 'warning',
  GAGNÉ: 'success',
  PERDU: 'danger',
};
