import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { CampaignAnalyticsPanel } from '@/components/organisms/CampaignAnalyticsPanel';
import { loadCampaignAnalytics } from '@/lib/campaigns/analytics';
import { buildFunnel } from '@/lib/funnel';
import { buildHeatmap } from '@/lib/analytics/heatmap';
import { buildRanking } from '@/lib/analytics/ranking';

vi.mock('@/lib/campaigns/analytics', () => ({ loadCampaignAnalytics: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/campagnes/abcd23',
}));

const campaign = {
  slug: 'abcd23', sponsorName: 'Nike', name: 'Été', product: null, destinationUrl: 'https://nike.fr', state: 'Active',
  dealId: null, distributedCount: 1000, createdAt: '2026-06-01T00:00:00Z', investedAmountEur: 600, venue: null,
  productImageUrl: null, rewardType: 'site', promoCode: null,
} as const;
const funnel = buildFunnel({ distribues: 1000, scannes: 200, formulaireVu: 100, formulaireSoumis: 30, offreAtteinte: 30 });

describe('CampaignAnalyticsPanel', () => {
  it('renders KPIs and every block once data arrives', async () => {
    (loadCampaignAnalytics as Mock).mockResolvedValue({
      overview: { current: { scans: 200, uniques: 150, leads: 30 }, previous: null },
      series: [],
      heatmap: buildHeatmap([{ dow: 1, hour: 21, scans: 50 }]),
      cities: buildRanking([{ label: 'Paris', scans: 120, uniques: 90 }]),
      devices: buildRanking([{ label: 'mobile', scans: 190 }]),
      os: buildRanking([{ label: 'iOS', scans: 120 }]),
    });
    render(<CampaignAnalyticsPanel campaign={campaign as never} funnel={funnel} />);
    expect(await screen.findByText('Taux scan → lead')).toBeInTheDocument();
    for (const h of ['Scans dans le temps', 'Entonnoir de conversion', 'Top villes', 'Quand scanne-t-on ?', 'Appareils', 'Systèmes']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
  });

  it('a campaign with zero scans shows one empty state, not six empty charts', async () => {
    (loadCampaignAnalytics as Mock).mockResolvedValue({
      overview: { current: { scans: 0, uniques: 0, leads: 0 }, previous: null },
      series: [], heatmap: buildHeatmap([]), cities: buildRanking([]), devices: buildRanking([]), os: buildRanking([]),
    });
    render(<CampaignAnalyticsPanel campaign={campaign as never} funnel={funnel} />);
    expect(await screen.findByText('Aucun scan sur cette période')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Top villes' })).not.toBeInTheDocument();
  });

  it('a failed load says so instead of spinning forever', async () => {
    (loadCampaignAnalytics as Mock).mockRejectedValue(new Error('boom'));
    render(<CampaignAnalyticsPanel campaign={campaign as never} funnel={funnel} />);
    expect(await screen.findByText('Données indisponibles. Réessayez plus tard.')).toBeInTheDocument();
  });
});
