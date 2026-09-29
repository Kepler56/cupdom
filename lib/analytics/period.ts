/**
 * PURE period arithmetic. The single source of the four timestamps every
 * stage-1 RPC consumes (p_from, p_to, p_prev_from, p_prev_to), so a KPI and its
 * trend can never be computed over mismatched windows.
 *
 * `now` is injected rather than read from the clock, so every branch is
 * deterministically testable.
 */
export type PeriodPreset = '7j' | '30j' | '90j' | 'tout';

export const PERIOD_PRESETS = Object.freeze([
  { id: '7j', label: '7 jours' },
  { id: '30j', label: '30 jours' },
  { id: '90j', label: '90 jours' },
  { id: 'tout', label: 'Tout' },
] as const satisfies readonly { id: PeriodPreset; label: string }[]);

export const DEFAULT_PERIOD: PeriodPreset = '30j';

const DAYS: Record<Exclude<PeriodPreset, 'tout'>, number> = { '7j': 7, '30j': 30, '90j': 90 };
const DAY_MS = 86_400_000;

export interface PeriodRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  /** False for 'tout' — no comparable prior window exists, so hide the trend. */
  hasPrevious: boolean;
}

/** Read the `?p=` URL parameter, falling back to the default on anything unrecognised. */
export function parsePeriod(raw: string | undefined): PeriodPreset {
  const match = PERIOD_PRESETS.find((p) => p.id === raw);
  return match ? match.id : DEFAULT_PERIOD;
}

export function resolvePeriod(preset: PeriodPreset, now: Date): PeriodRange {
  const to = new Date(now.getTime());

  if (preset === 'tout') {
    // All-time. There is no prior window: comparing against the void would
    // render as an infinite increase, so hasPrevious is false and the UI
    // omits the trend entirely rather than inventing one.
    const epoch = new Date(0);
    return { from: epoch, to, prevFrom: epoch, prevTo: epoch, hasPrevious: false };
  }

  const span = DAYS[preset] * DAY_MS;
  const from = new Date(now.getTime() - span);
  return {
    from,
    to,
    prevTo: from,
    prevFrom: new Date(from.getTime() - span),
    hasPrevious: true,
  };
}
