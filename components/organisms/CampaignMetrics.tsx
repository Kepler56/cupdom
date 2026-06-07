import type { CampaignStats } from '@/types/domain';

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-text">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-faint">{hint}</p>}
    </div>
  );
}

/** Key-metric tiles for a campaign (Spec 4 AC-9). `leads` is the distinct captured-lead count. */
export function CampaignMetrics({ stats, leads }: { stats: CampaignStats; leads: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Tile label="Scans uniques/jour" value={stats.uniquesPerDay} />
      <Tile label="Leads" value={leads} />
      <Tile label="Scans après clôture" value={stats.termineeScans} hint="Scans reçus en Terminée" />
      <Tile label="Bots" value={stats.bots} hint="Exclus du total" />
    </div>
  );
}
