export type PositionResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' };

type Failure = Extract<PositionResult, { ok: false }>['reason'];

const HIGH: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 };
const LOW: PositionOptions = { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 };

type Attempt = { ok: true; lat: number; lng: number } | { ok: false; code: number };

function attempt(geo: Geolocation, opts: PositionOptions): Promise<Attempt> {
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => resolve({ ok: false, code: err?.code }),
      opts,
    );
  });
}

function reasonOf(code: number): Failure {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable'; // 2 or anything unexpected
}

/** High-accuracy first; on timeout/unavailable retry once with a cheaper, cache-friendly fix. */
export async function requestPosition(geo: Geolocation | undefined | null): Promise<PositionResult> {
  if (!geo) return { ok: false, reason: 'unsupported' };
  const first = await attempt(geo, HIGH);
  if (first.ok) return first;
  if (first.code !== 2 && first.code !== 3) return { ok: false, reason: reasonOf(first.code) };
  const second = await attempt(geo, LOW);
  if (second.ok) return second;
  return { ok: false, reason: reasonOf(second.code) };
}
