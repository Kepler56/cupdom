'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMember } from '@/lib/profiles';
import type { Scope } from '@/types/domain';

const STORAGE_KEY = 'cupdom.scope';

// ── Pure helpers (exported for unit tests) ──────────────────────────────────
// Data is read-all via RLS; the scope is a CLIENT-SIDE view filter only.

/** Is a row owned by `ownerId` visible under the current scope? */
export function matchesScope(scope: Scope, myId: string | null, ownerId: string): boolean {
  switch (scope.kind) {
    case 'me':
      return ownerId === myId;
    case 'user':
      return ownerId === scope.userId;
    case 'all':
      return true;
  }
}

/** May the current user edit a row owned by `ownerId`? Only own rows, only in "Moi" scope. */
export function canEdit(scope: Scope, myId: string | null, ownerId: string): boolean {
  return scope.kind === 'me' && myId !== null && ownerId === myId;
}

// ── Context ─────────────────────────────────────────────────────────────────

interface ScopeContextValue {
  scope: Scope;
  setScope: (scope: Scope) => void;
  myId: string | null;
}

const ScopeContext = createContext<ScopeContextValue | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { member } = useMember();
  const myId = member?.id ?? null;
  const [scope, setScopeState] = useState<Scope>({ kind: 'me' });

  // Hydrate the persisted scope on mount (client only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setScopeState(JSON.parse(raw) as Scope);
    } catch {
      // ignore malformed / unavailable storage
    }
  }, []);

  const setScope = useCallback((next: Scope) => {
    setScopeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore unavailable storage
    }
  }, []);

  const value = useMemo<ScopeContextValue>(() => ({ scope, setScope, myId }), [scope, setScope, myId]);

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used within a ScopeProvider');
  return ctx;
}

/** Returns a predicate `(ownerId) => boolean` for filtering rows to the current scope. */
export function useScopeFilter(): (ownerId: string) => boolean {
  const { scope, myId } = useScope();
  return useCallback((ownerId: string) => matchesScope(scope, myId, ownerId), [scope, myId]);
}

/** Single source the UI uses to show/hide create/edit/delete controls. */
export function useCanEdit(ownerId: string): boolean {
  const { scope, myId } = useScope();
  return canEdit(scope, myId, ownerId);
}
