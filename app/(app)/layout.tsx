import type { ReactNode } from 'react';
import { requireMember } from '@/lib/auth-server';
import { ScopeProvider } from '@/lib/scope';
import { AppShell } from '@/components/organisms/AppShell';

/** Server layout for every authenticated page: guards the session (redirects to
 *  /login if not an allow-listed member), then mounts the scope provider + shell. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireMember();
  return (
    <ScopeProvider>
      <AppShell>{children}</AppShell>
    </ScopeProvider>
  );
}
