import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCsp } from '../../next.config';

/**
 * `next dev` bundles through an eval-based devtool, so the development policy has to
 * allow 'unsafe-eval' or React never hydrates. Production must never gain it — these
 * tests exist so the development escape hatch cannot quietly leak into a deploy.
 */
describe('Content-Security-Policy', () => {
  it('never allows eval in production', () => {
    expect(buildCsp(false)).not.toContain('unsafe-eval');
  });

  it('allows eval in development', () => {
    expect(buildCsp(true)).toContain("'unsafe-eval'");
  });

  it('changes nothing but script-src between the two modes', () => {
    const others = (csp: string) => csp.split('; ').filter((d) => !d.startsWith('script-src'));
    expect(others(buildCsp(true))).toEqual(others(buildCsp(false)));
  });

  it('refuses framing and object embedding in both modes', () => {
    for (const csp of [buildCsp(true), buildCsp(false)]) {
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
    }
  });

  // netlify.toml carries an identical copy for anything served outside the Next handler.
  // A browser intersects multiple CSP headers and takes the strictest, so drift between
  // the two silently tightens production. It serves production traffic only, so this also
  // proves the development-only 'unsafe-eval' is not copied across.
  it('matches the production policy shipped in netlify.toml', () => {
    const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');
    const line = toml.split('\n').find((l) => l.includes('Content-Security-Policy ='));
    expect(line, 'no Content-Security-Policy line in netlify.toml').toBeDefined();
    const shipped = line!.slice(line!.indexOf('"') + 1, line!.lastIndexOf('"'));
    expect(shipped).toBe(buildCsp(false));
  });
});
