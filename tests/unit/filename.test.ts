import { describe, expect, it } from 'vitest';
import { buildExportFilename } from '@/lib/export/filename';

const FIXED = new Date(2026, 5, 5, 12, 0, 0); // 2026-06-05 local
const contacts = { fileStem: 'contacts' };
const taches = { fileStem: 'taches' };
const nameOf = (id: string) =>
  id === 'u-max' ? 'Maxime' : id === 'u-jose' ? 'José Évrard' : id;

describe('buildExportFilename', () => {
  it('scope=me → _moi_', () => {
    expect(buildExportFilename(contacts, { kind: 'me' }, nameOf, FIXED)).toBe('contacts_moi_2026-06-05.csv');
  });
  it('scope=all → _tous_ (literal AC-45 example)', () => {
    expect(buildExportFilename(contacts, { kind: 'all' }, nameOf, FIXED)).toBe('contacts_tous_2026-06-05.csv');
  });
  it('scope=user → slugified colleague name, ASCII fileStem', () => {
    expect(buildExportFilename(taches, { kind: 'user', userId: 'u-max' }, nameOf, FIXED)).toBe(
      'taches_maxime_2026-06-05.csv',
    );
  });
  it('accents stripped and punctuation collapsed in the colleague slug', () => {
    expect(buildExportFilename(contacts, { kind: 'user', userId: 'u-jose' }, nameOf, FIXED)).toBe(
      'contacts_jose-evrard_2026-06-05.csv',
    );
  });
  it('uses the local calendar date (no UTC off-by-one)', () => {
    const late = new Date(2026, 5, 5, 23, 30, 0);
    expect(buildExportFilename(contacts, { kind: 'me' }, nameOf, late)).toContain('2026-06-05');
  });
});
