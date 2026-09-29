import { describe, expect, it } from 'vitest';
import { httpOrNull } from '@/lib/public/safeUrl';

describe('httpOrNull', () => {
  it('keeps https and http urls', () => {
    expect(httpOrNull('https://nike.fr/a?b=1')).toBe('https://nike.fr/a?b=1');
    expect(httpOrNull('http://nike.fr')).toBe('http://nike.fr');
  });
  it.each(['javascript:alert(1)', 'data:text/html,x', ''])('rejects %j', (v) => {
    expect(httpOrNull(v)).toBeNull();
  });
  it('rejects non-strings', () => {
    expect(httpOrNull(undefined)).toBeNull();
    expect(httpOrNull(42)).toBeNull();
    expect(httpOrNull(null)).toBeNull();
  });
});
