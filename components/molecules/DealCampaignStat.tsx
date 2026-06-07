import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { Tag } from '@/components/atoms/Tag';
import type { CampaignStat } from '@/types/domain';

const nf = new Intl.NumberFormat('fr-FR');

/**
 * One nested campaign's inline stats under a deal (Spec 4 AC-7): name + état Tag, then
 * Scans · Leads · Distribués · Conversion %, and a QR shortcut routing to the campaign detail
 * (where the full QR download lives). Read-only everywhere — the shortcut always works.
 */
export function DealCampaignStat({ stat }: { stat: CampaignStat; canEdit?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-input border border-border px-3 py-2 text-sm">
      <span className="font-medium text-text">{stat.name}</span>
      <Tag tone={stat.active ? 'success' : 'neutral'}>{stat.active ? 'Active' : 'Terminée'}</Tag>
      <span className="text-text-muted">Scans {nf.format(stat.scans)}</span>
      <span className="text-text-muted">Leads {nf.format(stat.leads)}</span>
      <span className="text-text-muted">Distribués {nf.format(stat.distribues)}</span>
      <span className="text-text-muted">Conv. {nf.format(stat.conversionPct)} %</span>
      <Link
        href={`/campagnes/${stat.slug}`}
        aria-label={`Détails et QR de ${stat.name}`}
        className="ml-auto text-text-muted hover:text-primary"
      >
        <Icon icon={QrCode} size={16} />
      </Link>
    </div>
  );
}
