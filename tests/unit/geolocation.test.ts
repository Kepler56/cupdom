import { describe, expect, it, vi } from 'vitest';
import { requestPosition } from '@/lib/public/geolocation';

type Step = { pos: { lat: number; lng: number } } | { code: number };

function fakeGeo(steps: Step[]) {
  const getCurrentPosition = vi.fn(
    (ok: PositionCallback, err: PositionErrorCallback, _opts?: PositionOptions) => {
      const step = steps.shift()!;
      if ('pos' in step) ok({ coords: { latitude: step.pos.lat, longitude: step.pos.lng } } as GeolocationPosition);
      else err({ code: step.code } as GeolocationPositionError);
    },
  );
  return { geo: { getCurrentPosition } as unknown as Geolocation, getCurrentPosition };
}

describe('requestPosition', () => {
  it('succeeds on the first try with high accuracy', async () => {
    const { geo, getCurrentPosition } = fakeGeo([{ pos: { lat: 1, lng: 2 } }]);
    expect(await requestPosition(geo)).toEqual({ ok: true, lat: 1, lng: 2 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  it('does not retry when denied', async () => {
    const { geo, getCurrentPosition } = fakeGeo([{ code: 1 }]);
    expect(await requestPosition(geo)).toEqual({ ok: false, reason: 'denied' });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('retries once with low accuracy after a timeout', async () => {
    const { geo, getCurrentPosition } = fakeGeo([{ code: 3 }, { pos: { lat: 3, lng: 4 } }]);
    expect(await requestPosition(geo)).toEqual({ ok: true, lat: 3, lng: 4 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(getCurrentPosition.mock.calls[1][2]).toEqual({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  });

  it("returns 'timeout' after two timeouts", async () => {
    const { geo, getCurrentPosition } = fakeGeo([{ code: 3 }, { code: 3 }]);
    expect(await requestPosition(geo)).toEqual({ ok: false, reason: 'timeout' });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("returns 'unavailable' when unavailable then failing again", async () => {
    const { geo } = fakeGeo([{ code: 2 }, { code: 2 }]);
    expect(await requestPosition(geo)).toEqual({ ok: false, reason: 'unavailable' });
  });

  it("returns 'denied' if the retry is denied", async () => {
    const { geo } = fakeGeo([{ code: 2 }, { code: 1 }]);
    expect(await requestPosition(geo)).toEqual({ ok: false, reason: 'denied' });
  });

  it("returns 'unsupported' without a Geolocation", async () => {
    expect(await requestPosition(undefined)).toEqual({ ok: false, reason: 'unsupported' });
  });
});
