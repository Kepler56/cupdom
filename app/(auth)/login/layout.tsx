import type { ReactNode } from 'react';

/**
 * Exists only to carry the title. `login/page.tsx` is a client component, and a
 * client component cannot export `metadata` — so /login silently inherited the root
 * layout's « Cupdom CRM », the same default every other page would show. Confirmed in
 * production before the fix. TRA-F04.
 *
 * Literal rather than a template, matching the portal, so the full string is greppable.
 */
export const metadata = { title: 'Connexion — CRM Cupdom' };

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
