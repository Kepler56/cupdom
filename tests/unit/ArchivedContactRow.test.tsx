import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchivedContactRow } from '@/components/molecules/ArchivedContactRow';
import { useCanEdit } from '@/lib/scope';
import type { ArchivedContact } from '@/types/domain';

vi.mock('@/lib/scope', () => ({ useCanEdit: vi.fn() }));
vi.mock('@/lib/contacts/lifecycle', () => ({ restoreContact: vi.fn() }));

const contact: ArchivedContact = {
  id: 'c1', ownerId: 'o1', firstName: 'Marie', lastName: 'Curie', role: null, email: null, phone: null,
  company: 'Acme', sector: null, companySize: null,
  archivedAt: '2026-06-01T00:00:00Z', purgeAfter: '2030-01-01T00:00:00Z', createdAt: '', updatedAt: '',
};

describe('ArchivedContactRow', () => {
  beforeEach(() => (useCanEdit as Mock).mockReset());

  it('shows the purge countdown and a Restaurer button for the owner', () => {
    (useCanEdit as Mock).mockReturnValue(true);
    render(<ArchivedContactRow contact={contact} onRestored={() => {}} />);
    expect(screen.getByText(/Supprimé dans/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurer' })).toBeInTheDocument();
  });

  it('hides Restaurer in read-only scope / for non-owners', () => {
    (useCanEdit as Mock).mockReturnValue(false);
    render(<ArchivedContactRow contact={contact} onRestored={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Restaurer' })).toBeNull();
  });
});
