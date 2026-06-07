import { FunnelBarRow } from '@/components/molecules/FunnelBarRow';
import type { Funnel } from '@/types/domain';

/**
 * The horizontal-bar conversion funnel (Spec 4 AC-9). Renders the five stages top→bottom; the
 * biggest abandonment step carries a red drop badge (the only colour deviation). `funnel` is the
 * output of lib/funnel.ts#buildFunnel.
 */
export function FunnelBars({ funnel }: { funnel: Funnel }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {funnel.steps.map((step, i) => (
          <FunnelBarRow key={step.key} step={step} isBiggestDrop={i === funnel.biggestDropIdx} />
        ))}
      </div>
      <p className="text-xs text-text-faint">% = conversion depuis l&apos;étape précédente.</p>
    </div>
  );
}
