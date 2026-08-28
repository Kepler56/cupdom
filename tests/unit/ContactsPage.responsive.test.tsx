import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContactsPage from '@/app/(app)/contacts/page';
import { listArchivedContacts, listContactsWithStatus } from '@/lib/contacts';

/**
 * CRM-C12. The toolbar above the table — tabs, search, Exporter, + Nouveau contact —
 * was one non-wrapping flex row holding a fixed w-56 search. Side by side those need
 * ~577px, so at 390px the whole PAGE scrolled sideways by ~200px.
 *
 * The existing e2e test « sur téléphone le tableau des contacts défile au lieu d'être
 * rogné » stayed green throughout, because it inspects the table (which scrolls
 * correctly inside its own container) and never the bar above it.
 *
 * jsdom has no layout engine, so this asserts the classes that produce the behaviour,
 * matching responsive.test.tsx. The measured proof is in the commit message.
 */
vi.mock('@/lib/profiles', () => ({ useProfiles: () => ({ profiles: {}, loading: false }) }));
vi.mock('@/lib/scope', () => ({
  useScope: () => ({ scope: { kind: 'me' }, setScope: () => {}, myId: 'me-1' }),
  useScopeFilter: () => () => true,
  useCanEdit: () => true,
}));
vi.mock('@/lib/contacts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/contacts')>()),
  listContactsWithStatus: vi.fn(),
  listArchivedContacts: vi.fn(),
}));

describe('ContactsPage toolbar (CRM-C12)', () => {
  beforeEach(() => {
    (listContactsWithStatus as Mock).mockResolvedValue([]);
    (listArchivedContacts as Mock).mockResolvedValue([]);
  });

  it('stacks the toolbar below sm instead of forcing one row', async () => {
    const { container } = render(<ContactsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Nouveau contact' })).toBeTruthy());

    const toolbar = container.querySelector('.space-y-4')!.firstElementChild as HTMLElement;
    expect(toolbar.className).toContain('flex-col');
    expect(toolbar.className).toContain('sm:flex-row');
    // Without this the row cannot shrink and the page scrolls instead.
    expect(toolbar.className).not.toMatch(/(^|\s)flex items-center justify-between gap-4($|\s)/);
  });

  it('lets the search field shrink on a phone and pins it back at sm', async () => {
    render(<ContactsPage />);
    const search = await screen.findByLabelText('Rechercher un contact');
    // Input renders <div.flex.flex-col> inside the width wrapper.
    const wrapper = search.closest('div')!.parentElement as HTMLElement;

    expect(wrapper.className).toContain('min-w-0');
    expect(wrapper.className).toContain('flex-1');
    expect(wrapper.className).toContain('sm:w-56');
    expect(wrapper.className).not.toMatch(/(^|\s)w-56($|\s)/); // no longer fixed at every width
  });
});
