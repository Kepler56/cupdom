import type { Scope } from '@/types/domain';

/** lowercase, strip accents, non-alphanumerics → single '-', trimmed. */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Filename scope token: 'moi' | 'tous' | slugified colleague name. */
export function scopeToken(scope: Scope, nameOf: (userId: string) => string): string {
  switch (scope.kind) {
    case 'me':
      return 'moi';
    case 'all':
      return 'tous';
    case 'user':
      return slugify(nameOf(scope.userId)) || 'collegue';
  }
}

/** Local calendar date YYYY-MM-DD (avoids the UTC off-by-one of toISOString in the evening). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** e.g. contacts_tous_2026-06-05.csv / taches_maxime_2026-06-05.csv (AC-45). */
export function buildExportFilename(
  dataset: { fileStem: string },
  scope: Scope,
  nameOf: (userId: string) => string = (id) => id,
  date: Date = new Date(),
): string {
  return `${dataset.fileStem}_${scopeToken(scope, nameOf)}_${toIsoDate(date)}.csv`;
}
