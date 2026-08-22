import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvestedAmountInput } from '@/components/molecules/InvestedAmountInput';
import { setInvestedAmount } from '@/lib/campaigns/campaigns';

vi.mock('@/lib/campaigns/campaigns', () => ({ setInvestedAmount: vi.fn() }));

const mockedSet = setInvestedAmount as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedSet.mockReset().mockResolvedValue(undefined);
});

describe('InvestedAmountInput', () => {
  it('saves a valid amount and shows the confirmation', async () => {
    render(<InvestedAmountInput slug="nike-hiver" value={null} canEdit />);
    const input = screen.getByLabelText('Montant investi (€)');

    await userEvent.type(input, '500');
    await userEvent.tab();

    expect(mockedSet).toHaveBeenCalledWith('nike-hiver', 500);
    expect(await screen.findByText('enregistré ✓')).toBeInTheDocument();
  });

  it('refuses a negative amount: does not call the setter, shows no confirmation, and reverts the field', async () => {
    // The setter clamps a negative amount to null for a programmatic caller,
    // but that clamp is invisible here: nothing forces a correction unless the
    // component itself refuses the value before ever calling setInvestedAmount.
    render(<InvestedAmountInput slug="nike-hiver" value={200} canEdit />);
    const input = screen.getByLabelText('Montant investi (€)') as HTMLInputElement;

    await userEvent.clear(input);
    await userEvent.type(input, '-500');
    await userEvent.tab();

    expect(mockedSet).not.toHaveBeenCalled();
    expect(screen.queryByText('enregistré ✓')).not.toBeInTheDocument();
    expect(input.value).toBe('200');
  });

  it('does nothing when not the campaign owner', async () => {
    render(<InvestedAmountInput slug="nike-hiver" value={null} canEdit={false} />);
    const input = screen.getByLabelText('Montant investi (€)');
    expect(input).toBeDisabled();
  });
});
