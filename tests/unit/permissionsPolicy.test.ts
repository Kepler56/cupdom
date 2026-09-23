import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The lead form's opt-in precise location (#5) calls navigator.geolocation. A
 * Permissions-Policy of `geolocation=()` disables that for every page: the call
 * fails instantly and every visitor sees « Localisation refusée ». That shipped
 * once in the headers and only a real-browser smoke test caught it (jsdom does not
 * enforce headers), so both copies of the header are pinned here.
 */
const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Permissions-Policy', () => {
  for (const file of ['next.config.ts', 'netlify.toml']) {
    it(`${file} allows geolocation for our own origin only`, () => {
      const src = read(file);
      expect(src).toContain('geolocation=(self)');
      expect(src).not.toMatch(/geolocation=\(\)/);
    });

    it(`${file} still blocks microphone, camera and payment`, () => {
      const src = read(file);
      expect(src).toContain('microphone=()');
      expect(src).toContain('camera=()');
      expect(src).toContain('payment=()');
    });
  }
});
