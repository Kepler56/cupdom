import { Tag } from '@/components/atoms/Tag';
import { STATUT_TONE } from '@/lib/status';
import type { Statut } from '@/types/domain';

/** Derived-statut pill (Prospect / En cours / Client / Perdu). Reused by the list + hub. */
export function StatutBadge({ statut }: { statut: Statut }) {
  return <Tag tone={STATUT_TONE[statut]}>{statut}</Tag>;
}
