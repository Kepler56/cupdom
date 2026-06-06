import { describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArchiveContactDialog } from '@/components/molecules/ArchiveContactDialog';
import { archiveContact } from '@/lib/contacts/lifecycle';

vi.mock('@/lib/contacts/lifecycle', () => ({ archiveContact: vi.fn() }));

describe('ArchiveContactDialog', () => {
  it('archives and calls onArchived on success', async () => {
    (archiveContact as Mock).mockResolvedValue({ ok: true });
    const onArchived = vi.fn();
    render(<ArchiveContactDialog contactId="c1" contactName="Acme" onClose={() => {}} onArchived={onArchived} />);

    fireEvent.click(screen.getByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(archiveContact).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(onArchived).toHaveBeenCalled());
  });

  it('surfaces the active-campaign block message and keeps the contact', async () => {
    (archiveContact as Mock).mockResolvedValue({
      ok: false,
      reason: 'active_campaign',
      message: 'Désactivez la campagne active avant de supprimer ce contact.',
    });
    const onArchived = vi.fn();
    render(<ArchiveContactDialog contactId="c1" contactName="Acme" onClose={() => {}} onArchived={onArchived} />);

    fireEvent.click(screen.getByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(screen.getByText(/Désactivez la campagne active/)).toBeInTheDocument());
    expect(onArchived).not.toHaveBeenCalled();
  });
});
