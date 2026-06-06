import { PURGE_WARNING_DAYS, type PurgeCountdown } from '@/types/domain';

const DAY_MS = 86_400_000;

/** Whole days until purge + a French label + tone (danger within the warning window). */
export function purgeCountdown(purgeAfter: string, now: Date = new Date()): PurgeCountdown {
  const daysLeft = Math.max(0, Math.ceil((new Date(purgeAfter).getTime() - now.getTime()) / DAY_MS));
  const tone: PurgeCountdown['tone'] = daysLeft <= PURGE_WARNING_DAYS ? 'danger' : 'warning';
  const label =
    daysLeft === 0 ? 'Suppression imminente' : `Supprimé dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;
  return { daysLeft, label, tone };
}
