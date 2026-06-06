import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactHubProfile } from '@/components/organisms/ContactHubProfile';
import { useCanEdit } from '@/lib/scope';
import type { ContactStatus } from '@/types/domain';

vi.mock('@/lib/scope', () => ({ useCanEdit: vi.fn() }));
vi.mock('@/lib/profiles', () => ({
  useProfiles: () => ({
    profiles: { o1: { id: 'o1', displayName: 'Eliah', color: '#18181b', email: 'eliah@cupdom.fr' } },
    loading: false,
  }),
}));

const contact: ContactStatus = {
  id: 'c1', ownerId: 'o1', firstName: 'Marie', lastName: 'Curie', role: 'CEO',
  email: 'marie@acme.fr', phone: '+33100000000', company: 'Acme',
  sector: 'Technologie & Logiciels', companySize: '10–49',
  archivedAt: null, purgeAfter: null, createdAt: '2026-01-01', updatedAt: '2026-01-02',
  statut: 'Client',
};

const noop = () => {};

describe('ContactHubProfile', () => {
  beforeEach(() => (useCanEdit as Mock).mockReset());

  it('renders statut, owner and coordonnées', () => {
    (useCanEdit as Mock).mockReturnValue(false);
    render(<ContactHubProfile contact={contact} onEdit={noop} onTransfer={noop} onArchive={noop} />);
    expect(screen.getByText('Client')).toBeInTheDocument();
    expect(screen.getByText('Eliah')).toBeInTheDocument();
    expect(screen.getByText('marie@acme.fr')).toBeInTheDocument();
  });

  it('shows owner actions and fires callbacks when editable', () => {
    (useCanEdit as Mock).mockReturnValue(true);
    const onEdit = vi.fn();
    const onTransfer = vi.fn();
    const onArchive = vi.fn();
    render(<ContactHubProfile contact={contact} onEdit={onEdit} onTransfer={onTransfer} onArchive={onArchive} />);

    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Transférer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archiver' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onTransfer).toHaveBeenCalledOnce();
    expect(onArchive).toHaveBeenCalledOnce();
  });

  it('hides actions when not editable (read-only scope / not owner)', () => {
    (useCanEdit as Mock).mockReturnValue(false);
    render(<ContactHubProfile contact={contact} onEdit={noop} onTransfer={noop} onArchive={noop} />);
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Transférer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Archiver' })).toBeNull();
  });
});
