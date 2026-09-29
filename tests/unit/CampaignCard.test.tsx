import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignCard } from '@/components/public/CampaignCard';

describe('CampaignCard', () => {
  it('shows photo, campaign name, product and sponsor', () => {
    render(
      <CampaignCard sponsor="Nike" campaign={{ name: 'Été 2026', product: 'Gourde', imageUrl: 'https://x.supabase.co/a.jpg', rewardType: 'site' }} />,
    );
    expect(screen.getByRole('heading', { name: 'Été 2026' })).toBeInTheDocument();
    expect(screen.getByText('Gourde')).toBeInTheDocument();
    expect(screen.getByText(/proposé par Nike/)).toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'Gourde' });
    expect(img).toHaveAttribute('width');
    expect(img).toHaveAttribute('height');
  });

  it('no photo → no image box; no name → falls back to the sponsor offer heading', () => {
    render(<CampaignCard sponsor="Nike" campaign={{ name: '', product: '', imageUrl: null, rewardType: 'site' }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /offre de Nike/ })).toBeInTheDocument();
  });
});
