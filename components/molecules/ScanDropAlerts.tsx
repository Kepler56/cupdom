'use client';

import Link from 'next/link';
import { TrendingDown, X } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import type { Notification } from '@/types/domain';

/**
 * The in-app alarm for a scan-drop (#6): a red card pinned to the corner of every
 * CRM page, one per unread incident, that stays until someone acknowledges it.
 *
 * WHY THIS AND NOT ONLY THE BELL. A peak-then-silence usually means something broke
 * mid-event while demand was live, so it must be hard to miss. A badge on a small
 * bell icon is easy to miss; this is not. It is also the channel that works with no
 * email configured — the scan-alert email is a bonus on top, not a dependency.
 *
 * Opening the campaign, or dismissing, marks the notification read, which removes
 * the card here and the item's unread state in the bell.
 */
export function ScanDropAlerts({
  alerts,
  onAcknowledge,
}: {
  alerts: Notification[];
  onAcknowledge: (id: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {alerts.slice(0, 3).map((n) => {
        const p = n.payload.kind === 'scan_drop' ? n.payload : null;
        if (!p) return null;
        return (
          <div key={n.id} className="rounded-card border border-danger-fg bg-surface p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-danger-fg">
                <Icon icon={TrendingDown} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">Chute de scans : {p.sponsorName ?? p.campaignSlug}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {p.burstCount} scans puis {p.dropCount} sur les {p.windowMinutes} min suivantes — quelque chose a
                  peut-être cassé sur le terrain.
                </p>
                <Link
                  href={`/campagnes/${p.campaignSlug}`}
                  onClick={() => onAcknowledge(n.id)}
                  className="mt-1.5 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Voir la campagne
                </Link>
              </div>
              <button
                type="button"
                aria-label="Ignorer l’alerte"
                onClick={() => onAcknowledge(n.id)}
                className="text-text-faint transition-colors hover:text-text"
              >
                <Icon icon={X} size={16} />
              </button>
            </div>
          </div>
        );
      })}
      {alerts.length > 3 && (
        <p className="text-right text-xs text-text-muted">+ {alerts.length - 3} autre(s) dans les notifications</p>
      )}
    </div>
  );
}
