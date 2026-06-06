/**
 * The public scan URL a campaign's QR encodes: `${BASE}/s/<slug>`.
 * Pure + side-effect free. It encodes ONLY the opaque slug — never the destination
 * or any secret (per the CLAUDE.md privacy model). The redirector (`/s/:slug`,
 * Spec 2B) resolves the slug to the sponsor destination server-side.
 */

/** Scan base origin (no trailing slash). Defaults to the prod domain. */
export function scanBase(): string {
  const raw = process.env.NEXT_PUBLIC_SCAN_BASE_URL ?? 'https://cupdom.fr';
  return raw.replace(/\/+$/, '');
}

/** The string the QR encodes for a campaign slug. */
export function scanUrl(slug: string): string {
  return `${scanBase()}/s/${slug}`;
}
