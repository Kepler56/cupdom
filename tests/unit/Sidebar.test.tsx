import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/organisms/Sidebar';

// Isolate the Sidebar from the router and data layer.
vi.mock('next/navigation', () => ({ usePathname: () => '/contacts' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/profiles', () => ({
  useMember: () => ({
    member: { id: '1', email: 'eliah@cupdom.fr', displayName: 'Eliah', color: '#18181b' },
    loading: false,
  }),
  useSignOut: () => () => Promise.resolve(),
}));
vi.mock('@/components/molecules/ScopeSwitcher', () => ({
  ScopeSwitcher: () => <div data-testid="scope-switcher" />,
}));

describe('Sidebar', () => {
  it('renders the six nav items', () => {
    render(<Sidebar />);
    for (const label of ['Aperçu', 'Contacts', 'Pipeline', 'Tâches', 'Rappels', 'Campagnes']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('marks the current route as active (aria-current)', () => {
    render(<Sidebar />);
    const active = screen.getByRole('link', { current: 'page' });
    expect(active).toHaveTextContent('Contacts');
  });

  it('shows the signed-in member identity and a logout control', () => {
    render(<Sidebar />);
    expect(screen.getByText('Eliah')).toBeInTheDocument();
    expect(screen.getByLabelText('Déconnexion')).toBeInTheDocument();
  });
});
