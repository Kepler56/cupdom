import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CampaignStatsCells } from '@/components/molecules/CampaignStatsCells';
import { CampaignsList } from '@/components/organisms/CampaignsList';
import type { CampaignRowVM, CampaignStats } from '@/types/domain';

// CampaignsList → CampaignRow calls useCanEdit; mock it (no ScopeProvider in unit render).
vi.mock('@/lib/scope', () => ({ useCanEdit: () => false }));
vi.mock('@/lib/campaigns/campaigns', () => ({ setCampaignState: vi.fn() }));

const stats = (over: Partial<CampaignStats> = {}): CampaignStats => ({
  slug: 's',
  totalScans: 10,
  uniquesPerDay: 6,
  bots: 2,
  activeScans: 7,
  termineeScans: 3,
  leads: 1,
  hasScans: true,
  ...over,
});

describe('CampaignStatsCells', () => {
  it('renders the five figures and separates Active vs Terminée', () => {
    const { container } = render(<CampaignStatsCells stats={stats()} />);
    expect(screen.getByText('Scans')).toBeInTheDocument();
    expect(screen.getByText('Uniques/j')).toBeInTheDocument();
    expect(screen.getByText('Bots')).toBeInTheDocument();
    expect(screen.getByText('Active / Terminée')).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
    // Active and Terminée are rendered in distinct (differently-coloured) spans.
    expect(container.querySelector('.text-success-fg')?.textContent).toBe('7');
  });
});

describe('CampaignsList headline', () => {
  const row = (slug: string, s: CampaignStats): CampaignRowVM => ({
    slug,
    sponsorName: slug,
    name: slug,
    product: null,
    destinationUrl: 'https://x.fr',
    state: 'Active',
    dealId: 'd',
    distributedCount: null,
    createdAt: '2026-06-01T00:00:00Z',
    investedAmountEur: null,
    venue: null,
    ownerId: 'o1',
    ownerName: 'A',
    ownerColor: '#000',
    contactCompany: slug,
    dealTitle: 'D',
    stats: s,
  });

  it('headline equals the sum of the visible rows stats', () => {
    const rows = [
      row('a', stats({ slug: 'a', totalScans: 10, uniquesPerDay: 6, bots: 2, leads: 1 })),
      row('b', stats({ slug: 'b', totalScans: 5, uniquesPerDay: 1, bots: 3, leads: 0 })),
    ];
    const { container } = render(<CampaignsList rows={rows} onChanged={() => {}} />);
    const headline = container.firstElementChild!.firstElementChild as HTMLElement; // the strip
    // Total scans 10 + 5 = 15 (unique); uniques/jour 6 + 1 = 7 (unique).
    expect(within(headline).getByText('15')).toBeInTheDocument();
    expect(within(headline).getByText('7')).toBeInTheDocument();
  });
});
