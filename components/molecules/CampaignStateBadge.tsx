import { Tag, type TagTone } from '@/components/atoms/Tag';
import type { CampaignState } from '@/types/domain';

const TONE: Record<CampaignState, TagTone> = {
  Active: 'success',
  Terminée: 'neutral',
};

/** Active / Terminée pill (Spec 2A). Reused by the row, event log, and detail page. */
export function CampaignStateBadge({ state }: { state: CampaignState }) {
  return <Tag tone={TONE[state]}>{state}</Tag>;
}
