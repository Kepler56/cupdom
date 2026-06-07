import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealCampaignStat } from '@/components/molecules/DealCampaignStat';
import type { CampaignStat } from '@/types/domain';

const stat = (over: Partial<CampaignStat> = {}): CampaignStat => ({
  slug: 'abcd23',
  name: 'Nike Été',
  active: true,
  scans: 120,
  leads: 18,
  distribues: 500,
  conversionPct: 15,
  ...over,
});

describe('DealCampaignStat', () => {
  it('renders name + état Tag + the four figures', () => {
    render(<DealCampaignStat stat={stat()} />);
    expect(screen.getByText('Nike Été')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Scans 120')).toBeInTheDocument();
    expect(screen.getByText('Leads 18')).toBeInTheDocument();
    expect(screen.getByText('Distribués 500')).toBeInTheDocument();
    expect(screen.getByText('Conv. 15 %')).toBeInTheDocument();
  });

  it('Terminée campaign shows the neutral état label', () => {
    render(<DealCampaignStat stat={stat({ active: false })} />);
    expect(screen.getByText('Terminée')).toBeInTheDocument();
  });

  it('the QR shortcut links to the campaign detail', () => {
    render(<DealCampaignStat stat={stat()} />);
    expect(screen.getByRole('link', { name: /Détails et QR/ })).toHaveAttribute('href', '/campagnes/abcd23');
  });

  it('conversion is 0 % when scans are 0 (no NaN)', () => {
    render(<DealCampaignStat stat={stat({ scans: 0, conversionPct: 0 })} />);
    expect(screen.getByText('Conv. 0 %')).toBeInTheDocument();
  });
});
