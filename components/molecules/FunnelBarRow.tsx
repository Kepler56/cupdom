import { Tag } from '@/components/atoms/Tag';
import type { FunnelStep } from '@/types/domain';

interface FunnelBarRowProps {
  step: FunnelStep;
  isBiggestDrop: boolean;
}

/**
 * One funnel stage (Spec 4 AC-9): label · count · a fluid bar (width = pctOfTop, --primary on a
 * --canvas track) · the per-step conversion %. When this is the biggest abandonment step, a danger
 * Tag "−{dropFromPrev} %" — the only colour deviation, reserved for the drop.
 */
export function FunnelBarRow({ step, isBiggestDrop }: FunnelBarRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-sm text-text">{step.label}</span>
      <span className="w-12 shrink-0 text-right text-sm tabular-nums text-text-muted">{step.count}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-input bg-canvas">
        <div
          className="h-full rounded-input bg-primary"
          style={{ width: `${step.pctOfTop}%` }}
          aria-hidden
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-muted">{step.pctOfPrev} %</span>
      <span className="w-20 shrink-0 text-right">
        {isBiggestDrop && <Tag tone="danger">−{step.dropFromPrev} %</Tag>}
      </span>
    </div>
  );
}
