// Shared, Deno-compatible retry for supabase-js operations in the Edge Functions.
//
// supabase-js resolves to `{ data, error }` rather than throwing, so we retry on a
// truthy `error`. Bounded and jittered for the same reason scan.js's retry is
// (lib/retry.mjs): under a burst PostgREST rejects with 503, and a synchronised
// retry storm would only add to the load that caused it.
//
// IDEMPOTENCY. lead-submit's three writes are safe to retry:
//   - the `leads` upsert is idempotent (onConflict → update);
//   - a duplicated `lead_consents` row is benign extra evidence, and far cheaper
//     than losing the consent record on a transient blip;
//   - duplicated `funnel_events` share the visitor_hash, and every count is
//     count(distinct visitor_hash), so a duplicate changes no figure.
// A helper that retried a plain, non-idempotent INSERT of business rows would need
// more care; these three do not.

export interface RetryResult {
  error: unknown;
}

export async function withRetry<T extends RetryResult>(
  op: () => Promise<T>,
  opts: {
    attempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
  } = opts;

  let last: T | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: T;
    try {
      res = await op();
    } catch (e) {
      // A thrown network error (rare for supabase-js) is treated like an error result.
      res = { error: e } as T;
    }
    if (!res.error) return res;
    last = res;
    if (attempt < attempts) {
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(backoff * (0.5 + random() * 0.5));
    }
  }
  return last as T;
}
