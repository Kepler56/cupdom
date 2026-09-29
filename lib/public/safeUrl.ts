/** Returns `v` only if it is an absolute http(s) URL; anything else (javascript:, data:, junk, non-strings) → null. */
export function httpOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : null;
  } catch {
    return null;
  }
}
