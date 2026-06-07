import { Tag, type TagTone } from '@/components/atoms/Tag';
import { TrendSparkline } from '@/components/molecules/TrendSparkline';
import type { KpiCardData } from '@/types/domain';

function trendTone(pct: number): TagTone {
  if (pct > 0) return 'success';
  if (pct < 0) return 'danger';
  return 'neutral';
}

function trendLabel(pct: number): string {
  if (pct > 0) return `+${pct} %`;
  if (pct < 0) return `−${Math.abs(pct)} %`;
  return '0 %';
}

/** One KPI tile (Spec 4 §4.1): muted label · large value · optional trend Tag + sparkline. */
export function KpiCard({ data }: { data: KpiCardData }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{data.label}</p>
      <p className="mt-2 text-2xl font-semibold text-text">{data.value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        {data.trendPct != null ? <Tag tone={trendTone(data.trendPct)}>{trendLabel(data.trendPct)}</Tag> : <span />}
        {data.trendSeries && <TrendSparkline series={data.trendSeries} />}
      </div>
    </div>
  );
}
