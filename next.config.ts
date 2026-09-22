import type { NextConfig } from "next";

/**
 * Security headers, defined HERE rather than only in netlify.toml.
 *
 * WHY: verified against the live deploy on 2026-08-23 — the `[[headers]]` block in
 * netlify.toml was NOT reaching any page response. /login, /campagne-terminee and
 * /confidentialite all returned 200 with no Content-Security-Policy, no
 * X-Frame-Options, no Referrer-Policy and no Permissions-Policy. The only headers
 * present were Netlify's own defaults, which is how we know: our HSTS is
 * max-age=63072000 but the wire showed max-age=31536000.
 *
 * With @netlify/plugin-nextjs v5 every route — static, SSR and middleware-redirected
 * alike — is served through the Next.js handler, so CDN-level header injection from
 * netlify.toml does not apply to them. Next applies these itself, to its own
 * responses, which is the only layer that reliably sees every request.
 *
 * netlify.toml keeps its identical copy for anything served outside the handler.
 * KEEP THE TWO IN SYNC — if they ever diverge and both apply, a browser intersects
 * multiple CSP headers and takes the STRICTEST, so a directive missing here would
 * silently override the one there.
 */
/**
 * 'unsafe-eval' is added to script-src in DEVELOPMENT ONLY.
 *
 * WHY: `next dev` bundles every module through webpack's eval-based devtool, so under a
 * policy without 'unsafe-eval' the browser refuses them — "Uncaught EvalError: unsafe-eval
 * is not an allowed source of script". React then never hydrates, the login form falls back
 * to a native HTML submit, and the Playwright suites fail wholesale (32 of 37 portal specs
 * on 2026-08-26) against a production build that is perfectly healthy.
 *
 * `next build` emits no eval, so PRODUCTION KEEPS THE STRICT POLICY. netlify.toml serves
 * production traffic only: the KEEP-IN-SYNC rule above covers the production directives and
 * must NOT be read as licence to copy 'unsafe-eval' over there.
 */
export function buildCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline' is required by Next's inline hydration scripts; a strict policy
    // would need per-request nonces from the framework.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const CSP = buildCsp(process.env.NODE_ENV !== "production");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * Netlify edge caching for the PUBLIC routes, measured against the live deploy on
 * 2026-09-06.
 *
 * WHY: /login is a fully prerendered page that runs no query, and it answered in
 * ~500 ms from France. Its own headers said why:
 *
 *   Cache-Status: "Netlify Durable"; hit, "Netlify Edge"; fwd=miss
 *   Cache-Control: public,max-age=0,must-revalidate
 *   Age: 785277
 *
 * A cache HIT that took half a second. `max-age=0, must-revalidate` is what
 * Next emits for a prerendered App Router page, and it forbids the edge POP
 * from serving its own copy without revalidating upstream — so every request was
 * forwarded to the durable cache in Ohio (CMH) and back, ~400 ms of Atlantic
 * crossing to re-fetch bytes that had not changed in nine days. Netlify's
 * function region is fixed on the free plan, so the fix is to stop crossing at
 * all rather than to move.
 *
 * Netlify-CDN-Cache-Control governs Netlify's cache ONLY and is stripped before
 * the browser, so the visitor-facing Cache-Control above is untouched: browsers
 * still revalidate, the edge stops going to Ohio.
 *
 * The list is an EXPLICIT ALLOW-LIST and must stay one. Every route here renders
 * identical HTML for every visitor and reads no session and no database. Adding
 * an authenticated route would cache one member's page at the edge and serve it
 * to the next visitor — the one change in this file that would be a security
 * incident rather than a bug. If you are unsure whether a route qualifies, it
 * does not.
 *
 *   /c/:slug            the QR lead form. The highest-traffic page in the product
 *                       — every person who scans a cup lands here — and the one
 *                       that gained most. It renders <LeadForm slug={slug} /> and
 *                       nothing else; the campaign's Active status and sponsor are
 *                       resolved CLIENT-SIDE through the lead-submit Edge Function
 *                       on every load. So a stale cached shell cannot show stale
 *                       campaign state: the state was never in the HTML. That is
 *                       what makes a long TTL safe here, not the TTL being short.
 *   /campagne-terminee  static notice, no read.
 *   /confidentialite    static policy, no read.
 *   /login              prerendered form, identical for everyone. Middleware treats
 *                       it as public and never redirects it, so caching it cannot
 *                       bypass an auth decision.
 *
 * Deliberately ABSENT: /set-password (prerendered and identical, but it is the
 * invite/recovery landing and not worth cacheing for its traffic), "/" (a redirect
 * into /apercu), and every route under (app).
 */
const EDGE_CACHE = "public, durable, s-maxage=86400, stale-while-revalidate=604800";

const PUBLIC_CACHEABLE_ROUTES = ["/c/:slug", "/campagne-terminee", "/confidentialite", "/login"];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      ...PUBLIC_CACHEABLE_ROUTES.map((source) => ({
        source,
        headers: [{ key: "Netlify-CDN-Cache-Control", value: EDGE_CACHE }],
      })),
    ];
  },
};

export default nextConfig;
