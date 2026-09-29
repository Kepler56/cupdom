import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { RewardEditDialog } from '@/components/molecules/RewardEditDialog';
import { setReward } from '@/lib/campaigns/campaigns';

vi.mock('@/lib/campaigns/campaigns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/campaigns/campaigns')>()),
  setReward: vi.fn(),
}));

const campaign = { slug: 'abcd23', destinationUrl: 'https://nike.fr', rewardType: 'site' as const, promoCode: null };

describe('RewardEditDialog', () => {
  it('saves a switch to promo', async () => {
    (setReward as Mock).mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    render(<RewardEditDialog campaign={campaign} onDone={onDone} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Code promo' }));
    fireEvent.change(screen.getByLabelText('Code promo'), { target: { value: 'CUPDOM10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(setReward).toHaveBeenCalledWith('abcd23', {
      rewardType: 'promo',
      promoCode: 'CUPDOM10',
      destinationUrl: 'https://nike.fr',
    });
  });

  it('shows the French message for a missing code', async () => {
    (setReward as Mock).mockResolvedValue({ ok: false, error: 'missing_code' });
    render(<RewardEditDialog campaign={campaign} onDone={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Code promo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Saisissez le code promo.')).toBeInTheDocument();
  });
});
