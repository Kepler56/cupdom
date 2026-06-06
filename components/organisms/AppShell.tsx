'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const TITLES: Record<string, string> = {
  '/apercu': 'Aperçu',
  '/contacts': 'Contacts',
  '/pipeline': 'Pipeline',
  '/taches': 'Tâches',
  '/rappels': 'Rappels',
  '/campagnes': 'Campagnes',
};

function titleFor(pathname: string): string {
  const base = `/${pathname.split('/')[1] ?? ''}`;
  return TITLES[base] ?? 'Cupdom';
}

/** The authenticated app frame: sidebar + per-page top bar around the page content. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titleFor(pathname)} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
