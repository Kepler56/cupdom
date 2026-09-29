import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RewardFields } from '@/components/molecules/RewardFields';

describe('RewardFields', () => {
  it('site mode shows only the destination', () => {
    render(<RewardFields rewardType="site" promoCode="" destination="" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Site web du client' })).toBeChecked();
    expect(screen.getByLabelText('Destination (http/https)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code promo')).not.toBeInTheDocument();
  });

  it('promo mode shows the code and the « where to use it » link', () => {
    render(<RewardFields rewardType="promo" promoCode="CUPDOM10" destination="" onChange={() => {}} />);
    expect(screen.getByLabelText('Code promo')).toHaveValue('CUPDOM10');
    expect(screen.getByLabelText('Lien pour utiliser le code (http/https)')).toBeInTheDocument();
  });

  it('switching mode reports a patch', () => {
    const onChange = vi.fn();
    render(<RewardFields rewardType="site" promoCode="" destination="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Code promo' }));
    expect(onChange).toHaveBeenCalledWith({ rewardType: 'promo' });
  });
});
