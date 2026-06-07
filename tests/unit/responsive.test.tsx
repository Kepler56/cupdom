import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '@/components/organisms/AppShell';
import { ApercuKpiRow } from '@/components/organisms/ApercuKpiRow';
import type { KpiCardData } from '@/types/domain';

// Mock the heavy children so we can test the shell's responsive drawer logic in isolation.
vi.mock('next/navigation', () => ({ usePathname: () => '/apercu' }));
vi.mock('@/components/organisms/Sidebar', () => ({ Sidebar: () => <nav data-testid="sidebar" /> }));
vi.mock('@/components/organisms/NotificationBell', () => ({ NotificationBell: () => <span /> }));
vi.mock('@/components/molecules/SearchBox', () => ({ SearchBox: () => <span /> }));

describe('AppShell responsive (AC-12)', () => {
  it('renders a desktop sidebar + a hamburger; the hamburger opens the drawer (a second sidebar)', () => {
    render(
      <AppShell>
        <p>contenu</p>
      </AppShell>,
    );
    // Only the desktop sidebar at first.
    expect(screen.getAllByTestId('sidebar')).toHaveLength(1);
    const menu = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(menu.className).toContain('lg:hidden'); // collapse trigger only below the breakpoint
    fireEvent.click(menu);
    expect(screen.getAllByTestId('sidebar')).toHaveLength(2); // desktop + drawer
  });
});

describe('ApercuKpiRow wrap (AC-12)', () => {
  it('uses a grid that collapses 4 → 2 → 1', () => {
    const cards: KpiCardData[] = [
      { key: 'contacts_actifs', label: 'Contacts actifs', value: '12', trendPct: null },
      { key: 'scans_30j', label: 'Scans (30 j)', value: '120', trendPct: 20 },
      { key: 'leads_30j', label: 'Leads (30 j)', value: '8', trendPct: -5 },
      { key: 'pipeline_eur', label: 'Pipeline', value: '25 000 €', trendPct: null },
    ];
    const { container } = render(<ApercuKpiRow cards={cards} />);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('sm:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-4');
  });
});
