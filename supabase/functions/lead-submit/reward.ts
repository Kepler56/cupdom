// Pure reward helpers for lead-submit (spec §4.3). No Deno globals → Vitest imports it.
// promo_code NEVER leaves the server except in the two code-bearing replies below
// ('failed' and 'show'), and only after a valid-looking submission that passed the
// honeypot — so the code cannot be scraped via form_view.

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

/**
 * Reply outcomes (promo mode; site mode always redirects):
 * - 'sent'    : the code was emailed → no code on the wire.
 * - 'skipped' : honeypot, or the recipient was already emailed recently → looks sent, no code.
 * - 'failed'  : the email failed after retries → the code travels so the page shows it.
 * - 'show'    : rate-limited (not honeypot) → nothing stored, no email, the code is shown.
 */
export type RewardOutcome = 'sent' | 'failed' | 'skipped' | 'show';

export function rewardReply(
  rewardType: RewardType,
  destination: string,
  outcome: RewardOutcome,
  code: string | null,
): SubmitReply {
  if (rewardType === 'site') return { redirect: destination };
  if ((outcome === 'failed' || outcome === 'show') && code) return { promo: { link: destination, emailed: false, code } };
  return { promo: { link: destination, emailed: true } };
}

/** Per-recipient promo-email throttle window: one email per (campaign, address) per 24 h. */
export const PROMO_EMAIL_WINDOW_MS = 24 * 3600_000;

/**
 * True when the existing lead for this (campaign, email) was active within the throttle
 * window, i.e. it was (or could have been) emailed already — so the promo email must NOT be
 * re-sent. Stops the form being used to fire the email at an arbitrary address repeatedly.
 * A missing or unparseable timestamp is treated as "not recent" (first contact).
 */
export function recentlyEmailed(lastActivityAt: string | null, now: Date): boolean {
  if (!lastActivityAt) return false;
  const t = Date.parse(lastActivityAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t < PROMO_EMAIL_WINDOW_MS;
}
