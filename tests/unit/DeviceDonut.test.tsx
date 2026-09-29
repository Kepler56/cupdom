import { render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceDonut } from '@/components/charts/DeviceDonut';
import { buildRanking, UNKNOWN_LABEL } from '@/lib/analytics/ranking';

const ranking = buildRanking([
  { label: 'Mobile', scans: 880 },
  { label: 'Ordinateur', scans: 80 },
  { label: 'Tablette', scans: 40 },
]);

// jsdom has no ResizeObserver at all, and Recharts 2.15's ResponsiveContainer
// calls `new ResizeObserver(...)` unconditionally in its mount effect. Scoped
// to this file, exactly as tests/unit/ScansArea.test.tsx does — this stub only
// stops the constructor call from throwing; it does not make the chart
// actually draw, since jsdom's getBoundingClientRect() still reports 0x0.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('DeviceDonut', () => {
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // The 0x0 measurement above is the jsdom limitation, and Recharts warns
    // about it on every render. That one warning is known, so it is swallowed
    // here rather than polluting the suite's output — but nothing else gets a
    // free pass: a React 19 incompatibility or a future Recharts deprecation
    // prints a DIFFERENT message and fails this assertion instead of hiding in
    // the spy. The same guard as tests/unit/ScansArea.test.tsx, which this file
    // had copied the stub from without the guard.
    //
    // try/finally, not a bare sequence: a FAILING guard throws out of the hook,
    // and without the finally console.warn would stay stubbed for every
    // remaining test in this file.
    try {
      for (const call of warnSpy.mock.calls) {
        expect(call[0]).toMatch(/width\(0\) and height\(0\)/);
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  // Recharts cannot draw inside jsdom — ResponsiveContainer measures its parent
  // and every element measures 0x0 — so the assertions here cover the legend,
  // which is where the numbers actually live. The arc itself is covered by the
  // Playwright run, which has a real layout engine.
  it('lists every device with its share', () => {
    render(<DeviceDonut ranking={ranking} />);
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('88 %', { collapseWhitespace: false })).toBeInTheDocument();
  });

  it('renders an empty state rather than an empty ring', () => {
    render(<DeviceDonut ranking={buildRanking([])} />);
    expect(screen.getByText(/pas encore/i)).toBeInTheDocument();
  });

  // A dimension whose every value is the unknown bucket would draw one full
  // circle labelled « Inconnu — 100 % ». `Ranking.empty` is what says "this
  // dimension carries no information", and the donut now reads it.
  it('says the information could not be determined when every row is unknown', () => {
    render(<DeviceDonut ranking={buildRanking([{ label: UNKNOWN_LABEL, scans: 500 }])} />);
    expect(screen.getByText(/pas permis de déterminer/i)).toBeInTheDocument();
    expect(screen.queryByText(UNKNOWN_LABEL)).toBeNull();
    expect(screen.queryByText(/pas encore de données/i)).toBeNull();
  });
});
