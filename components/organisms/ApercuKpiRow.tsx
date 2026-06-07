import { KpiCard } from '@/components/molecules/KpiCard';
import type { KpiCardData } from '@/types/domain';

/** The four Aperçu KPI cards (Spec 4 §4.1). Grid wraps 4 → 2 → 1 on narrow viewports (AC-12). */
export function ApercuKpiRow({ cards }: { cards: KpiCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <KpiCard key={c.key} data={c} />
      ))}
    </div>
  );
}
