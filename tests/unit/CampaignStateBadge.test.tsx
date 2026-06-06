import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignStateBadge } from '@/components/molecules/CampaignStateBadge';

describe('CampaignStateBadge', () => {
  it('Active → success tone + label "Active"', () => {
    render(<CampaignStateBadge state="Active" />);
    const tag = screen.getByText('Active');
    expect(tag).toBeInTheDocument();
    expect(tag.className).toContain('bg-success-bg');
  });

  it('Terminée → neutral tone + label "Terminée"', () => {
    render(<CampaignStateBadge state="Terminée" />);
    const tag = screen.getByText('Terminée');
    expect(tag).toBeInTheDocument();
    expect(tag.className).toContain('bg-border'); // neutral tone
  });
});
