import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EndedCampaignCard } from '@/components/public/EndedCampaignCard';

describe('EndedCampaignCard', () => {
  it('renders exactly one h1 with the French ended message', () => {
    render(<EndedCampaignCard />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Cette campagne n'est plus active");
  });

  it('renders a "Découvrir Cupdom" CTA linking exactly to https://cupdom.fr', () => {
    render(<EndedCampaignCard />);
    const link = screen.getByRole('link', { name: 'Découvrir Cupdom' });
    expect(link).toHaveAttribute('href', 'https://cupdom.fr');
  });
});
