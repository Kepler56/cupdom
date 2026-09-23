/**
 * Pure "peak-then-drop" detection logic for the scan-drop alert (#6).
 *
 * This is the exact math the production detector runs in SQL
 * (`public.detect_scan_drops()`, migration 0019). It lives here as a pure,
 * dependency-free mirror so the windowing/threshold decision can be unit-tested
 * against synthetic scan series without a database — the same discipline the
 * daily-digest email builder follows. Keep the two in lockstep: if a default or
 * a boundary changes here, change it in 0019 too.
 *
 * The signal is a CLIFF, not a tail-off: a real burst (>= peakThreshold non-bot
 * scans in one window) followed by near-silence in the very next window means
 * something broke while demand was live (a dead redirect, a bad print batch, a
 * venue outage), and the CRM team should hear about it in near-real time.
 */

export interface ScanDropConfig {
  /** Scans in the burst window must reach this to arm the alert. Boss: "from 5 scans". */
  peakThreshold: number;
  /** Fire when the drop window falls to <= floor(dropRatio * burst). 0.20 = "below 20% of the peak". 0 = hard stop to zero. */
  dropRatio: number;
  /** Each window's width in minutes. */
  windowMinutes: number;
}

export const DEFAULT_SCAN_DROP_CONFIG: ScanDropConfig = {
  peakThreshold: 5,
  dropRatio: 0.2,
  windowMinutes: 10,
};

export interface ScanEvent {
  scannedAt: Date;
  isBot: boolean;
}

export interface WindowCounts {
  burst: number;
  drop: number;
}

/**
 * Count non-bot scans in the two adjacent windows ending at `now`:
 *   burst = [now - 2W, now - W)   — "the peak"
 *   drop  = [now - W, now]        — "the immediately following window" (most recent)
 * Bot scans are excluded so a crowd of link-preview crawlers can't fake a peak.
 */
export function countWindows(series: ScanEvent[], now: Date, windowMinutes: number): WindowCounts {
  const ms = windowMinutes * 60_000;
  const t = now.getTime();
  const burstFrom = t - 2 * ms;
  const burstTo = t - ms; // exclusive
  const dropFrom = t - ms; // inclusive
  const dropTo = t; // inclusive

  let burst = 0;
  let drop = 0;
  for (const e of series) {
    if (e.isBot) continue;
    const at = e.scannedAt.getTime();
    if (at >= burstFrom && at < burstTo) burst++;
    else if (at >= dropFrom && at <= dropTo) drop++;
  }
  return { burst, drop };
}

/**
 * Given the two window counts, decide whether this is a peak-then-drop cliff.
 * Mirrors the fire condition in 0019: `burst >= peakThreshold AND drop <= floor`.
 * (The other guards — active campaign, min age, cooldown, quiet hours, open
 * incident — live in the SQL around this core, because they need state this
 * pure function deliberately does not carry.)
 */
export function classifyWindow(counts: WindowCounts, config: ScanDropConfig): { fire: boolean } {
  const floor = Math.floor(config.dropRatio * counts.burst);
  const fire = counts.burst >= config.peakThreshold && counts.drop <= floor;
  return { fire };
}

/** Convenience: count then classify in one call. */
export function detectScanDrop(
  series: ScanEvent[],
  now: Date,
  config: ScanDropConfig = DEFAULT_SCAN_DROP_CONFIG,
): { fire: boolean; counts: WindowCounts } {
  const counts = countWindows(series, now, config.windowMinutes);
  return { fire: classifyWindow(counts, config).fire, counts };
}
