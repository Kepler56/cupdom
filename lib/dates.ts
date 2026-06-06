// Date-only helpers (compare calendar dates, not instants) + French formatting.
// Dates are ISO yyyy-mm-dd strings; lexical comparison is correct for that format.

/** Today's local calendar date as yyyy-mm-dd (avoids the UTC off-by-one of toISOString). */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** A task is overdue when it is not done and its due date is today or earlier (AC-25). */
export function isOverdue(dueDate: string | null, doneAt: string | null, now: Date = new Date()): boolean {
  if (doneAt !== null) return false;
  if (!dueDate) return false;
  return dueDate <= todayLocal(now);
}

/** A reminder is due when it is not done and its remind-on date is today or earlier (AC-27). */
export function isDue(remindOn: string, doneAt: string | null, now: Date = new Date()): boolean {
  if (doneAt !== null) return false;
  return remindOn <= todayLocal(now);
}

/** Format a yyyy-mm-dd date as fr-FR (dd/mm/yyyy); em-dash for null. */
export function formatFr(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${date}T00:00:00`));
}

/** Relative French time for the activity timeline. */
export function timeAgoFr(iso: string, now: Date = new Date()): string {
  const sec = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.floor(mo / 12);
  return `il y a ${y} an${y > 1 ? 's' : ''}`;
}
