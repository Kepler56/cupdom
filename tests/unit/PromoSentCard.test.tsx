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

  it('never renders a non-http link', () => {
    render(<PromoSentCard email="m@g.com" reply={{ link: 'javascript:alert(1)', emailed: true }} />);
    expect(screen.queryByRole('link', { name: 'Utiliser mon code' })).not.toBeInTheDocument();
  });
});
