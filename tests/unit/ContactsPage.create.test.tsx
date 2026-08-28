import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactsPage from '@/app/(app)/contacts/page';
import { createContact, listArchivedContacts, listContactsWithStatus } from '@/lib/contacts';

/**
 * The member profile loads asynchronously (ScopeProvider sets `myId = member?.id ?? null`)
 * while the scope defaults to `{ kind: 'me' }` synchronously — so "+ Nouveau contact" is
 * already live for about a second before an owner id exists. Saving inside that window used
 * to call nothing, close the form anyway and show no error: the typed contact just vanished.
 */
let myId: string | null = null;

vi.mock('@/lib/profiles', () => ({ useProfiles: () => ({ profiles: {}, loading: false }) }));
vi.mock('@/lib/scope', () => ({
  useScope: () => ({ scope: { kind: 'me' }, setScope: () => {}, myId }),
  useScopeFilter: () => () => true,
  useCanEdit: () => true,
}));
vi.mock('@/lib/contacts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/contacts')>()),
  listContactsWithStatus: vi.fn(),
  listArchivedContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
}));

async function fillAndSaveNewContact() {
  render(<ContactsPage />);
  const open = await screen.findByRole('button', { name: '+ Nouveau contact' });
  fireEvent.click(open);
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
}

describe('ContactsPage — saving a new contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listContactsWithStatus as Mock).mockResolvedValue([]);
    (listArchivedContacts as Mock).mockResolvedValue([]);
    (createContact as Mock).mockResolvedValue({ id: 'c1' });
  });

  it('never closes the form silently when the owner id is not known yet', async () => {
    myId = null;
    await fillAndSaveNewContact();

    // Nothing could be persisted...
    await waitFor(() => expect(createContact).not.toHaveBeenCalled());

    // ...so the member is told, and the typed contact is still on screen to retry.
    expect(
      await screen.findByText('Enregistrement impossible (lecture seule ou champ invalide).'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Nouveau contact' })).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toHaveValue('Camille');
  });

  it('creates the contact once the owner id is known', async () => {
    myId = 'me-1';
    await fillAndSaveNewContact();

    await waitFor(() =>
      expect(createContact).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Camille' }), 'me-1'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nouveau contact' })).not.toBeInTheDocument(),
    );
  });
});
