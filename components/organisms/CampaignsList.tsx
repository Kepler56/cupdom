'use client';

import { type ReactNode } from 'react';
import { CampaignRow } from '@/components/molecules/CampaignRow';
import { sumStats } from '@/lib/campaigns/stats';
import type { CampaignRowVM } from '@/types/domain';

interface CampaignsListProps {
  rows: CampaignRowVM[];
  onChanged: () => void;
  /** Per-row owner actions (edit/delete/history), injected by the create-flow plan. */
  renderActions?: (row: CampaignRowVM) => ReactNode;
}

function Headline({ rows }: { rows: CampaignRowVM[] }) {
  const t = sumStats(rows.map((r) => r.stats));
  const items: { label: string; value: ReactNode }[] = [
    { label: 'Scans', value: t.totalScans },
    { label: 'Uniques/jour', value: t.uniquesPerDay },
    { label: 'Bots', value: t.bots },
    {
      label: 'Active / Terminée',
      value: (
        <>
          <span className="text-success-fg">{t.activeScans}</span>
          <span className="text-text-faint"> / </span>
          <span className="text-text-muted">{t.termineeScans}</span>
        </>
      ),
    },
    { label: 'Leads', value: t.leads },
  ];
  return (
    <div className="flex flex-wrap gap-6 rounded-card border border-border bg-surface px-5 py-4">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col">
          <span className="text-lg font-semibold tabular-nums text-text">{it.value}</span>
          <span className="text-xs text-text-muted">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function CampaignsList({ rows, onChanged, renderActions }: CampaignsListProps) {
  return (
    <div className="space-y-4">
      <Headline rows={rows} />

      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-strong p-8 text-center text-sm text-text-muted">
          Aucune campagne.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-faint">
                <th className="px-3 py-2 font-medium">Campagne</th>
                <th className="px-3 py-2 font-medium">Sponsor</th>
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">État</th>
                <th className="px-3 py-2 font-medium">Statistiques</th>
                <th className="px-3 py-2 font-medium">QR</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <CampaignRow
                  key={row.slug}
                  row={row}
                  onChanged={onChanged}
                  actions={renderActions?.(row)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
