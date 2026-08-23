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
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' is required by Next's inline hydration scripts; a strict policy
  // would need per-request nonces from the framework.
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
