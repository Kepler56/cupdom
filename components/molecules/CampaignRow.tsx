'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, History, MoreHorizontal, Pencil, Power, QrCode, Trash2 } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { OwnerChip } from '@/components/molecules/OwnerChip';
import { CampaignStateBadge } from '@/components/molecules/CampaignStateBadge';
import { CampaignStatsCells } from '@/components/molecules/CampaignStatsCells';
import { QrDialog } from '@/components/molecules/QrDialog';
import { DestinationEditDialog } from '@/components/molecules/DestinationEditDialog';
import { DeleteCampaignDialog } from '@/components/molecules/DeleteCampaignDialog';
import { CampaignEventLog } from '@/components/organisms/CampaignEventLog';
import { useCanEdit } from '@/lib/scope';
import { setCampaignState } from '@/lib/campaigns/campaigns';
import type { CampaignRowVM, CampaignState } from '@/types/domain';

interface CampaignRowProps {
  row: CampaignRowVM;
  onChanged: () => void;
}

/**
 * One campaign row. QR view/download + Historique are available to everyone (AC-9/17);
 * the state toggle and edit/delete actions render ONLY when `useCanEdit(ownerId)` is true
 * (owner + scope Moi). Colleague/Tous scope and legacy (ownerId === null) rows are
 * read-only with an owner chip (AC-16/26).
 */
export function CampaignRow({ row, onChanged }: CampaignRowProps) {
  const canEdit = useCanEdit(row.ownerId ?? '');
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  function closeMenu() {
    setMenuOpen(false);
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

          <div className="relative">
            <button
              type="button"
              aria-label="Plus d'actions"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-input p-1 text-text-muted hover:bg-canvas hover:text-text"
            >
              <Icon icon={MoreHorizontal} size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-card border border-border bg-surface text-sm shadow-lg">
                <Link
                  href={`/campagnes/${row.slug}`}
                  onClick={closeMenu}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-text hover:bg-canvas"
                >
                  <Icon icon={BarChart3} size={14} /> Détails &amp; leads
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    setHistoryOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-text hover:bg-canvas"
                >
                  <Icon icon={History} size={14} /> Historique
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setEditOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-text hover:bg-canvas"
                    >
                      <Icon icon={Pencil} size={14} /> Modifier la destination
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setDeleteOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-danger-fg hover:bg-danger-bg"
                    >
                      <Icon icon={Trash2} size={14} /> Supprimer
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </td>

      {qrOpen && <QrDialog campaign={row} onClose={() => setQrOpen(false)} />}
      {historyOpen && <CampaignEventLog slug={row.slug} onClose={() => setHistoryOpen(false)} />}
      {editOpen && (
        <DestinationEditDialog
          campaign={row}
          onClose={() => setEditOpen(false)}
          onDone={() => {
            setEditOpen(false);
            onChanged();
          }}
        />
      )}
      {deleteOpen && (
        <DeleteCampaignDialog
          campaign={row}
          hasScans={row.stats.hasScans}
          onClose={() => setDeleteOpen(false)}
          onDone={() => {
            setDeleteOpen(false);
            onChanged();
          }}
        />
      )}
    </tr>
  );
}
