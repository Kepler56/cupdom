import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PromoSentCard } from '@/components/public/PromoSentCard';

describe('PromoSentCard', () => {
  it('emailed: congratulates, names the address, links to where to use the code', () => {
    render(<PromoSentCard email="marie@gmail.com" reply={{ link: 'https://nike.fr/panier', emailed: true }} />);
    expect(screen.getByRole('heading', { name: /Félicitations/ })).toBeInTheDocument();
    expect(screen.getByText(/marie@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/spams/)).toBeInTheDocument();
    const a = screen.getByRole('link', { name: 'Utiliser mon code' });
    expect(a).toHaveAttribute('href', 'https://nike.fr/panier');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('C10')).not.toBeInTheDocument();
  });

  it('email failed: shows the code itself', () => {
    render(<PromoSentCard email="m@g.com" reply={{ link: 'https://nike.fr', emailed: false, code: 'C10' }} />);
    expect(screen.getByRole('heading', { name: 'Voici votre code promo' })).toBeInTheDocument();
    expect(screen.getByText('C10')).toBeInTheDocument();
  });

  it('emailed false and no code: no false email claim, neutral thanks', () => {
    render(<PromoSentCard email="m@g.com" reply={{ link: 'https://nike.fr', emailed: false }} />);
    expect(screen.getByRole('heading', { name: /Merci/ })).toBeInTheDocument();
    expect(screen.getByText(/contactez la marque/)).toBeInTheDocument();
    expect(screen.queryByText(/Nous vous avons envoyé/)).not.toBeInTheDocument();
  });

  it('never renders a non-http link', () => {
    render(<PromoSentCard email="m@g.com" reply={{ link: 'javascript:alert(1)', emailed: true }} />);
    expect(screen.queryByRole('link', { name: 'Utiliser mon code' })).not.toBeInTheDocument();
  });

  it('carries the campaign photo band when the campaign is passed', () => {
    render(
      <PromoSentCard
        email="m@g.com"
        reply={{ link: 'https://on.com', emailed: true }}
        sponsor="On"
        campaign={{ name: 'Cloud X4', product: 'chaussure', imageUrl: 'https://x.supabase.co/a.jpg', rewardType: 'promo' }}
      />,
    );
    expect(screen.getByRole('img', { name: 'chaussure' })).toHaveAttribute('src', 'https://x.supabase.co/a.jpg');
    expect(screen.getByText('On · Offre exclusive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Félicitations/ })).toBeInTheDocument();
  });

  it('no photo on the campaign → the same tinted fallback as the form', () => {
    render(
      <PromoSentCard
        email="m@g.com"
        reply={{ link: 'https://on.com', emailed: true }}
        sponsor="On"
        campaign={{ name: 'Cloud X4', product: '', imageUrl: null, rewardType: 'promo' }}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-fallback')).toBeInTheDocument();
  });
});
