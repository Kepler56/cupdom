'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { toCsv } from '@/lib/export/toCsv';
import { downloadCsv } from '@/lib/export/downloadCsv';
import { leadCsvColumns } from '@/lib/export/leadsLoaders';
import { listCampaignLeads } from '@/lib/leads';
import { eraseLead } from '@/lib/leads/erase';
import type { Lead } from '@/types/domain';

const fmtDate = (v: string | null): string => (v ? new Intl.DateTimeFormat('fr-FR').format(new Date(v)) : '');
const isAnonymised = (l: Lead): boolean => !l.firstName && !l.lastName && !l.email && !l.phone;

interface CampaignLeadsTableProps {
  slug: string;
  /** The campaign owner (scope Moi) may erase lead PII (RGPD, AC-15); read-only off-scope (AC-13). */
  canEdit: boolean;
}

/** Owner-visible leads list on a campaign (read-only for everyone except the RGPD erase action). */
export function CampaignLeadsTable({ slug, canEdit }: CampaignLeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listCampaignLeads(slug)
      .then((l) => {
        if (active) {
          setLeads(l);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  function exportLeads() {
    if (leads.length === 0) return;
    const today = new Intl.DateTimeFormat('fr-CA').format(new Date()); // YYYY-MM-DD
    downloadCsv(`leads_${slug}_${today}.csv`, toCsv(leads, leadCsvColumns));
  }

  async function doErase() {
    if (!confirm) return;
    setBusy(true);
    const res = await eraseLead(confirm.id);
    setBusy(false);
    if (res.ok) {
      setLeads((prev) =>
        prev.map((l) => (l.id === confirm.id ? { ...l, firstName: null, lastName: null, email: null, phone: null } : l)),
      );
      setMsg('Données du lead effacées');
    } else {
      setMsg(res.message);
    }
    setConfirm(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Leads capturés</h2>
        <Button variant="secondary" size="sm" disabled={leads.length === 0} onClick={exportLeads}>
          <Icon icon={Download} size={15} /> Exporter les leads
        </Button>
      </div>

      {msg && (
        <p className="text-xs text-text-muted" role="status">
          {msg}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : leads.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">
          Aucun lead capturé.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Téléphone</th>
                <th className="px-3 py-2 font-medium">Capturé le</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const anon = isAnonymised(l);
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 text-text">
                      {anon ? (
                        <span className="italic text-text-faint">Lead anonymisé</span>
                      ) : (
                        `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim() || '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">{l.email ?? '—'}</td>
                    <td className="px-3 py-2.5 text-text-muted">{l.phone ?? '—'}</td>
                    <td className="px-3 py-2.5 text-text-muted">{fmtDate(l.firstSeenAt)}</td>
                    {canEdit && (
                      <td className="px-3 py-2.5 text-right">
                        {!anon && (
                          <button
                            type="button"
                            onClick={() => setConfirm(l)}
                            className="inline-flex items-center gap-1 text-xs text-danger-fg hover:underline"
                          >
                            <Icon icon={Trash2} size={13} /> Effacer (RGPD)
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Effacer les données du lead"
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
            <h3 className="mb-3 text-base font-semibold text-text">Effacer les données personnelles ?</h3>
            <p className="mb-6 text-sm text-text-muted">
              Le prénom, le nom, l&apos;email et le téléphone de ce lead seront supprimés définitivement. Les
              statistiques anonymes (entonnoir) sont conservées.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Annuler
              </Button>
              <Button variant="danger-outline" disabled={busy} onClick={() => void doErase()}>
                {busy ? 'Effacement…' : 'Effacer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
