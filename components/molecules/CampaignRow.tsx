'use client';

import { useState, type ReactNode } from 'react';
import { Power, QrCode } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { OwnerChip } from '@/components/molecules/OwnerChip';
import { CampaignStateBadge } from '@/components/molecules/CampaignStateBadge';
import { CampaignStatsCells } from '@/components/molecules/CampaignStatsCells';
import { QrDialog } from '@/components/molecules/QrDialog';
import { useCanEdit } from '@/lib/scope';
import { setCampaignState } from '@/lib/campaigns/campaigns';
import type { CampaignRowVM, CampaignState } from '@/types/domain';

interface CampaignRowProps {
  row: CampaignRowVM;
  onChanged: () => void;
  /** Owner-only actions (edit destination / delete / history), injected by the create-flow plan. */
  actions?: ReactNode;
}

/**
 * One campaign row. QR view/download is available to everyone (AC-9); the state toggle
 * and owner actions render ONLY when `useCanEdit(ownerId)` is true (owner + scope Moi).
 * Colleague/Tous scope and legacy (ownerId === null) rows are read-only with an owner chip (AC-16/26).
 */
export function CampaignRow({ row, onChanged, actions }: CampaignRowProps) {
  const canEdit = useCanEdit(row.ownerId ?? '');
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const next: CampaignState = row.state === 'Active' ? 'Terminée' : 'Active';

  async function toggle() {
    setBusy(true);
    try {
      await setCampaignState(row.slug, next);
      onChanged();
    } catch {
      // read-only / RLS — badge stays unchanged
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2.5 font-medium text-text">{row.name ?? row.sponsorName}</td>
      <td className="px-3 py-2.5 text-text-muted">{row.contactCompany ?? row.sponsorName}</td>
      <td className="px-3 py-2.5 text-text-muted">{row.dealTitle ?? '—'}</td>
      <td className="px-3 py-2.5">
        <CampaignStateBadge state={row.state} />
      </td>
      <td className="px-3 py-2.5">
        <CampaignStatsCells stats={row.stats} />
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          aria-label="Voir le QR"
          className="inline-flex items-center gap-1.5 rounded-input border border-border-strong px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary"
        >
          <Icon icon={QrCode} size={14} /> QR
        </button>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-2">
          {canEdit ? (
            <button
              type="button"
              onClick={() => void toggle()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-input border border-border-strong px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary disabled:opacity-40"
            >
              <Icon icon={Power} size={14} /> {row.state === 'Active' ? 'Terminer' : 'Réactiver'}
            </button>
          ) : row.ownerName ? (
            <OwnerChip name={row.ownerName} color={row.ownerColor ?? '#999'} />
          ) : (
            <span className="text-xs text-text-faint">— non lié</span>
          )}
          {actions}
        </div>
      </td>

      {qrOpen && <QrDialog campaign={row} onClose={() => setQrOpen(false)} />}
    </tr>
  );
}
