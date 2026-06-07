// Branded "Campagne terminée / indisponible" tile (Spec 2B §6/§9).
// Visuals are intentionally minimal — Spec 4 §5.2 owns the polish. Logic/copy/a11y are the contract here.
//
// SECURITY (CLAUDE.md house rules): this component renders NO user/dynamic input — there is no slug
// or query param interpolated into the DOM, so no injection surface. If dynamic copy is ever added it
// MUST go through escapeHtml, and any link MUST be validated with safeUrl (http/https only). The
// cupdom.fr CTA is a hard-coded constant on purpose.

const CUPDOM_URL = 'https://cupdom.fr';

export function EndedCampaignCard() {
  return (
    <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center shadow-sm">
      <span
        className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-input bg-primary text-lg font-bold text-primary-contrast"
        aria-hidden
      >
        C
      </span>

      <h1 className="mb-3 text-xl font-semibold text-text">Cette campagne n&apos;est plus active</h1>
      <p className="mb-8 text-sm leading-relaxed text-text-muted">
        Le QR que vous avez scanné ne pointe vers aucune offre en ce moment. Merci de votre curiosité&nbsp;!
      </p>

      <a
        href={CUPDOM_URL}
        className="inline-flex items-center justify-center rounded-input bg-primary px-5 py-2.5 text-sm font-medium text-primary-contrast transition-opacity hover:opacity-90"
      >
        Découvrir Cupdom
      </a>
    </div>
  );
}
