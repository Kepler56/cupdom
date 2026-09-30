import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignCard, valueLine } from '@/components/public/CampaignCard';

const WITH_PHOTO = { name: 'Été 2026', product: 'Gourde', imageUrl: 'https://x.supabase.co/a.jpg', rewardType: 'site' as const };

describe('CampaignCard', () => {
  it('leads with the product photo (alt = product type), then the campaign name and the sponsor pill', () => {
    render(<CampaignCard sponsor="Nike" campaign={WITH_PHOTO} />);
    expect(screen.getByRole('heading', { name: 'Été 2026' })).toBeInTheDocument();
    expect(screen.getByText('Nike · Offre exclusive')).toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'Gourde' });
    expect(img).toHaveAttribute('src', WITH_PHOTO.imageUrl);
    expect(img).toHaveAttribute('width');
    expect(img).toHaveAttribute('height');
    // The product type is no longer shown as text — only as the photo's alt.
    expect(screen.queryByText('Gourde')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-fallback')).not.toBeInTheDocument();
  });

  it('a photo that fails to load swaps to the tinted fallback, the text stays', () => {
    render(<CampaignCard sponsor="Nike" campaign={{ ...WITH_PHOTO, imageUrl: 'https://x.supabase.co/gone.jpg' }} />);
    fireEvent.error(screen.getByRole('img', { name: 'Gourde' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-fallback')).toHaveTextContent('N');
    expect(screen.getByRole('heading', { name: 'Été 2026' })).toBeInTheDocument();
  });

  it('no photo → tinted banner with the sponsor initial, never a broken image', () => {
    render(<CampaignCard sponsor="On" campaign={{ ...WITH_PHOTO, imageUrl: null }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const banner = screen.getByTestId('hero-fallback');
    expect(banner).toHaveTextContent('O');
    expect(banner).toHaveAttribute('aria-hidden');
    expect(screen.getByText('On · Offre exclusive')).toBeInTheDocument();
  });

  it('no name → falls back to the sponsor offer heading', () => {
    render(<CampaignCard sponsor="Nike" campaign={{ name: '', product: '', imageUrl: null, rewardType: 'site' }} />);
    expect(screen.getByRole('heading', { name: /offre de Nike/ })).toBeInTheDocument();
  });

  it('value line — site mode', () => {
    render(<CampaignCard sponsor="On" campaign={WITH_PHOTO} />);
    expect(screen.getByText("Accédez à l'offre On")).toBeInTheDocument();
    expect(screen.queryByText(/code promo/)).not.toBeInTheDocument();
  });

  it('value line — promo mode', () => {
    render(<CampaignCard sponsor="On" campaign={{ ...WITH_PHOTO, rewardType: 'promo' }} />);
    expect(screen.getByText('Recevez votre code promo On par e-mail')).toBeInTheDocument();
  });

  it('value line without a sponsor name stays grammatical', () => {
    expect(valueLine('promo', '')).toBe('Recevez votre code promo par e-mail');
    expect(valueLine('site', '')).toBe("Accédez à l'offre");
  });

  it('never renders a non-http image src', () => {
    render(<CampaignCard sponsor="On" campaign={{ ...WITH_PHOTO, imageUrl: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
  });
});
