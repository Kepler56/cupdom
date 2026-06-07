// Tiny inline SVG trend line (Spec 4 §4.1) — quiet, no axis/fill/lib. Renders nothing for < 2 points.
export function TrendSparkline({ series }: { series: number[] }) {
  if (!series || series.length < 2) return null;
  const w = 64;
  const h = 20;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
