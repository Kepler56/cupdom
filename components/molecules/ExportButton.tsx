'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';
import { useScope } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import { toCsv } from '@/lib/export/toCsv';
import { downloadCsv } from '@/lib/export/downloadCsv';
import { buildExportFilename } from '@/lib/export/filename';
import { EXPORT_DATASETS, getDataset } from '@/lib/export/datasets';
import type { DatasetId } from '@/types/domain';

interface ExportButtonProps<T> {
  /** The dataset this mount holds rows for (e.g. 'contacts' on the Contacts page). */
  datasetId: DatasetId;
  /** The rows CURRENTLY VISIBLE on the page (already scope-filtered by the caller). */
  rows: T[];
  /** Extra datasets this mount can also produce (same `rows` shape). */
  extraDatasetIds?: DatasetId[];
}

/**
 * "Exporter" control: a menu of datasets, exporting the current scope-filtered rows to a CSV.
 * Export mirrors visibility — it never re-fetches or re-filters; it serialises exactly `rows`.
 * Not gated by useCanEdit (export is allowed read-only in every scope).
 */
export function ExportButton<T>({ datasetId, rows, extraDatasetIds }: ExportButtonProps<T>) {
  const { scope } = useScope();
  const { profiles } = useProfiles();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const allowed = new Set<DatasetId>([datasetId, ...(extraDatasetIds ?? [])]);
  const nameOf = (ownerId: string) => profiles[ownerId]?.displayName ?? ownerId;

  function run(id: DatasetId) {
    setOpen(false);
    if (rows.length === 0) {
      setMsg('Aucune donnée à exporter');
      return;
    }
    const ds = getDataset(id, nameOf);
    const csv = toCsv(rows as unknown[], ds.columns);
    downloadCsv(buildExportFilename(ds, scope, nameOf), csv);
    setMsg('✓ CSV téléchargé');
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        <Icon icon={Download} size={15} /> Exporter
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-card border border-border bg-surface shadow-lg">
          {EXPORT_DATASETS.map((ds) => {
            const enabled = ds.available && allowed.has(ds.id);
            return (
              <button
                key={ds.id}
                type="button"
                disabled={!enabled}
                aria-disabled={!enabled}
                onClick={() => enabled && run(ds.id)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                  enabled ? 'text-text hover:bg-canvas' : 'cursor-not-allowed text-text-faint',
                )}
              >
                {ds.label}
                {!ds.available && <span className="text-xs text-text-faint">bientôt</span>}
              </button>
            );
          })}
        </div>
      )}

      {msg && (
        <p className="mt-1 text-xs text-text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
