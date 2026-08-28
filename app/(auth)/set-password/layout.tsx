import type { ReactNode } from 'react';

/** Same reason as login/layout.tsx: the page is a client component. TRA-F04. */
export const metadata = { title: 'Nouveau mot de passe — CRM Cupdom' };

export default function SetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
