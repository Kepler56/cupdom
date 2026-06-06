import type { CampaignStats } from '@/types/domain';

function Cell({ label, value, title }: { label: string; value: number | string; title?: string }) {
  return (
    <div className="flex flex-col items-end leading-tight" title={title}>
      <span className="text-sm font-semibold tabular-nums text-text">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-text-faint">{label}</span>
    </div>
  );
}

/**
 * The five headline figures for one campaign (AC-25/27). `total` is non-bot scans
 * (bots are shown separately, never folded into the total). The Active/Terminée split
 * is rendered as a distinguishable pair (AC-27).
 */
export function CampaignStatsCells({ stats }: { stats: CampaignStats }) {
  return (
    <div className="flex items-center gap-4">
      <Cell label="Scans" value={stats.totalScans} title="Scans hors bots" />
      <Cell label="Uniques/j" value={stats.uniquesPerDay} title="Visiteurs uniques par jour" />
      <Cell label="Bots" value={stats.bots} title="Scans détectés comme bots (exclus du total)" />
      <div
        className="flex flex-col items-end leading-tight"
        title="Scans pendant Active / pendant Terminée"
      >
        <span className="text-sm font-semibold tabular-nums">
          <span className="text-success-fg">{stats.activeScans}</span>
          <span className="text-text-faint"> / </span>
          <span className="text-text-muted">{stats.termineeScans}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wide text-text-faint">Active / Terminée</span>
      </div>
      <Cell label="Leads" value={stats.leads} title="Leads capturés (Spec 3)" />
    </div>
  );
}
