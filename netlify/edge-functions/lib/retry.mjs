// Pure, isomorphic helper — runs on the Deno edge runtime and Node's test runner.
// No Deno/Node-specific APIs; `sleep` and `random` are injected so the backoff
// is deterministic under test.

/**
 * Bounded, jittered retry for a fire-and-forget write.
 *
 * WHY THIS EXISTS. `scan.js` logs each scan with a single fire-and-forget POST
 * to PostgREST inside `context.waitUntil`. Under a burst, PostgREST's fixed
 * connection pool queues and then rejects requests (503/504); the old code
 * swallowed that in a bare `.catch`, so the scan was silently lost with the
 * scanner none the wiser (the redirect had already succeeded). This turns a
 * transient rejection into an eventual success.
 *
 * TWO INVARIANTS, both load-bearing:
 *  1. It NEVER throws. A logging path must not become a new failure source; the
 *     caller gets a result object, always. A throw escaping `waitUntil` would be
 *     an unhandled rejection on the edge.
 *  2. It runs entirely AFTER the response (the caller schedules it in
 *     `waitUntil`), so retries never touch redirect latency. The total backoff
 *     is capped so the retries fit inside Netlify's `waitUntil` budget rather
 *     than being reclaimed mid-sleep.
 *
 * Retries on a network error, a 5xx, or a 429 (pool saturation / rate limit).
 * Gives up immediately on any other 4xx: a malformed row (422) or an auth
 * problem (401/403) will never succeed on retry, and hammering it only adds to
 * the load that caused the failure. Jitter (50–100% of the backoff) is
 * mandatory, not cosmetic: the same burst that fails every request would
 * otherwise make every isolate retry in lockstep and amplify the pool storm.
 *
 * @param {() => Promise<Response>} doFetch  performs one attempt.
 * @returns {Promise<{ok: boolean, status: number, attempts: number, error: string|null}>}
 */
export async function postWithRetry(doFetch, opts = {}) {
  const {
    attempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
  } = opts;

  let lastStatus = 0;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await doFetch();
      if (res && res.ok) return { ok: true, status: res.status, attempts: attempt, error: null };
      lastStatus = res ? res.status : 0;
      // A non-retryable client error stays broken on retry — bail without waiting.
      if (lastStatus >= 400 && lastStatus < 500 && lastStatus !== 429) {
        return { ok: false, status: lastStatus, attempts: attempt, error: null };
      }
    } catch (e) {
      lastError = e;
    }

    if (attempt < attempts) {
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      // 50–100% of the backoff: spreads a synchronized burst of retries out.
      const jittered = backoff * (0.5 + random() * 0.5);
      await sleep(jittered);
    }
  }

  return {
    ok: false,
    status: lastStatus,
    attempts,
    error: lastError ? String((lastError && lastError.message) || lastError) : null,
  };
}
