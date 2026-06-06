'use client';

import { useScope } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import type { Scope } from '@/types/domain';

const USER_PREFIX = 'user:';

function scopeToValue(scope: Scope): string {
  if (scope.kind === 'me') return 'me';
  if (scope.kind === 'all') return 'all';
  return `${USER_PREFIX}${scope.userId}`;
}

function valueToScope(value: string): Scope {
  if (value === 'me') return { kind: 'me' };
  if (value === 'all') return { kind: 'all' };
  return { kind: 'user', userId: value.slice(USER_PREFIX.length) };
}

/** Vue switcher: Moi / each colleague / Tous. Sets the client-side view scope. */
export function ScopeSwitcher() {
  const { scope, setScope, myId } = useScope();
  const { profiles } = useProfiles();
  const colleagues = Object.values(profiles)
    .filter((p) => p.id !== myId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">Vue</span>
      <select
        aria-label="Vue"
        value={scopeToValue(scope)}
        onChange={(e) => setScope(valueToScope(e.target.value))}
        className="w-full rounded-input border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="me">Moi</option>
        {colleagues.map((p) => (
          <option key={p.id} value={`${USER_PREFIX}${p.id}`}>
            {p.displayName}
          </option>
        ))}
        <option value="all">Tous</option>
      </select>
    </label>
  );
}
