'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { toCsv } from '@/lib/export/toCsv';
import { downloadCsv } from '@/lib/export/downloadCsv';
import { listCampaignLeads } from '@/lib/leads';
import type { CsvColumn, Lead } from '@/types/domain';

const fmtDate = (v: string | null): string => (v ? new Intl.DateTimeFormat('fr-FR').format(new Date(v)) : '');

// Per-campaign lead hand-off CSV (Spec 3A AC-12) — FR headers, reuses 1F toCsv/downloadCsv.
// Export is read-only and allowed in EVERY scope (not useCanEdit-gated, per 1F §4) so a
// colleague/Tous viewer can still hand a CSV to the sponsor.
const leadCsvColumns: CsvColumn<Lead>[] = [
  { header: 'Prénom', value: (l) => l.firstName },
  { header: 'Nom', value: (l) => l.lastName },
  { header: 'Email', value: (l) => l.email },
  { header: 'Téléphone', value: (l) => l.phone },
  { header: 'Capturé le', value: (l) => fmtDate(l.firstSeenAt) },
];

interface CampaignLeadsTableProps {
  slug: string;
}

/** Owner-visible leads list on a campaign (read-only for everyone — leads are not member-editable). */
export function CampaignLeadsTable({ slug }: CampaignLeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Leads capturés</h2>
        <Button variant="secondary" size="sm" disabled={leads.length === 0} onClick={exportLeads}>
          <Icon icon={Download} size={15} /> Exporter les leads
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : leads.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">
          Aucun lead capturé.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="px-3 py-2 font-medium">Nom</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Téléphone</th>
                <th className="px-3 py-2 font-medium">Capturé le</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 text-text">{`${l.firstName ?? ''} ${l.lastName ?? ''}`.trim() || '—'}</td>
                  <td className="px-3 py-2.5 text-text-muted">{l.email ?? '—'}</td>
                  <td className="px-3 py-2.5 text-text-muted">{l.phone ?? '—'}</td>
                  <td className="px-3 py-2.5 text-text-muted">{fmtDate(l.firstSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
