'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
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

/** The authenticated app frame: sidebar + per-page top bar around the page content.
 *  Below the CRM breakpoint (lg) the sidebar collapses into a toggled drawer (AC-12). */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop: static sidebar. */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile: slide-over drawer. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-text/30" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 shadow-xl">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={titleFor(pathname)} onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
