import { describe, expect, it } from 'vitest';
import { canEdit, matchesScope } from '@/lib/scope';
import type { Scope } from '@/types/domain';

const ME = 'user-a';
const OTHER = 'user-b';
const THIRD = 'user-c';

describe('matchesScope (client-side view filter)', () => {
  it('scope=me → only my own rows', () => {
    const s: Scope = { kind: 'me' };
    expect(matchesScope(s, ME, ME)).toBe(true);
    expect(matchesScope(s, ME, OTHER)).toBe(false);
  });

  it('scope=user → only that colleague’s rows', () => {
    const s: Scope = { kind: 'user', userId: OTHER };
    expect(matchesScope(s, ME, OTHER)).toBe(true);
    expect(matchesScope(s, ME, ME)).toBe(false);
    expect(matchesScope(s, ME, THIRD)).toBe(false);
  });

  it('scope=all → every row', () => {
    const s: Scope = { kind: 'all' };
    expect(matchesScope(s, ME, ME)).toBe(true);
    expect(matchesScope(s, ME, OTHER)).toBe(true);
  });

  it('no member id (loading/signed out) → nothing matches in "me"', () => {
    expect(matchesScope({ kind: 'me' }, null, ME)).toBe(false);
  });
});

describe('canEdit (UI show/hide of write controls)', () => {
  it('only my own rows, only in "me" scope', () => {
    expect(canEdit({ kind: 'me' }, ME, ME)).toBe(true);
    expect(canEdit({ kind: 'me' }, ME, OTHER)).toBe(false);
  });

  it('never editable in a colleague view (even my own rows)', () => {
    expect(canEdit({ kind: 'user', userId: ME }, ME, ME)).toBe(false);
  });

  it('never editable in "Tous" scope', () => {
    expect(canEdit({ kind: 'all' }, ME, ME)).toBe(false);
  });

  it('no member id → never editable', () => {
    expect(canEdit({ kind: 'me' }, null, ME)).toBe(false);
  });
});
