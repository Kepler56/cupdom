import { describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferDialog } from '@/components/molecules/TransferDialog';
import { transferContact } from '@/lib/transfer';
import type { ContactStatus } from '@/types/domain';

vi.mock('@/lib/profiles', () => ({
  useProfiles: () => ({
    profiles: {
      o1: { id: 'o1', displayName: 'Eliah', color: '#000', email: '' },
      o2: { id: 'o2', displayName: 'Maxime', color: '#111', email: '' },
      o3: { id: 'o3', displayName: 'Contact', color: '#222', email: '' },
    },
    loading: false,
  }),
}));
vi.mock('@/lib/transfer', () => ({ transferContact: vi.fn() }));

const contact = { id: 'c1', ownerId: 'o1' } as ContactStatus;

describe('TransferDialog', () => {
  it('lists only the other members (excludes the current owner)', () => {
    render(<TransferDialog contact={contact} onClose={() => {}} onDone={() => {}} />);
    const select = screen.getByLabelText('Nouveau propriétaire');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Maxime');
    expect(options).toContain('Contact');
    expect(options).not.toContain('Eliah'); // current owner excluded
  });

  it('transfers to the chosen member and calls onDone', async () => {
    (transferContact as Mock).mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    render(<TransferDialog contact={contact} onClose={() => {}} onDone={onDone} />);

    fireEvent.change(screen.getByLabelText('Nouveau propriétaire'), { target: { value: 'o2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transférer' }));

    await waitFor(() => expect(transferContact).toHaveBeenCalledWith('c1', 'o2'));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });
});
