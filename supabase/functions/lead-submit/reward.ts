// Pure reward helpers for lead-submit (spec §4.3). No Deno globals → Vitest imports it.
// promo_code NEVER leaves the server except in the one failure reply below, and only
// after a valid, stored submission — so the code cannot be scraped via form_view.

export type RewardType = 'site' | 'promo';

export interface PublicCampaign {
  name: string;
  product: string;
  imageUrl: string | null;
  rewardType: RewardType;
}

export type SubmitReply = { redirect: string } | { promo: { link: string; emailed: boolean; code?: string } };

export function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function publicCampaign(row: { name?: unknown; product?: unknown; product_image_url?: unknown; reward_type?: unknown }): PublicCampaign {
  return {
    name: str(row.name),
    product: str(row.product),
    imageUrl: safeHttpUrl(row.product_image_url),
    rewardType: row.reward_type === 'promo' ? 'promo' : 'site',
  };
}

export function rewardReply(
  rewardType: RewardType,
  destination: string,
  outcome: 'sent' | 'failed' | 'skipped',
  code: string | null,
): SubmitReply {
  if (rewardType === 'site') return { redirect: destination };
  if (outcome === 'failed' && code) return { promo: { link: destination, emailed: false, code } };
  return { promo: { link: destination, emailed: true } };
}
