import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
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

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const campaign = {
  slug: 'abcd23', sponsorName: 'Nike', name: 'Été', product: null, destinationUrl: 'https://nike.fr', state: 'Active',
  dealId: null, distributedCount: 1000, createdAt: '2026-06-01T00:00:00Z', investedAmountEur: 600, venue: null,
  productImageUrl: null, rewardType: 'site', promoCode: null,
} as const;
const funnel = buildFunnel({ distribues: 1000, scannes: 200, formulaireVu: 100, formulaireSoumis: 30, offreAtteinte: 30 });

describe('CampaignAnalyticsPanel', () => {
  beforeEach(() => {
    (loadCampaignAnalytics as Mock).mockReset();
  });

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

  describe('period switching', () => {
    const payload = (scans: number) => ({
      overview: { current: { scans, uniques: scans - 1, leads: 30 }, previous: null },
      series: [],
      heatmap: buildHeatmap([{ dow: 1, hour: 21, scans: 50 }]),
      cities: buildRanking([{ label: 'Paris', scans: 120, uniques: 90 }]),
      devices: buildRanking([{ label: 'mobile', scans: 190 }]),
      os: buildRanking([{ label: 'iOS', scans: 120 }]),
    });
    const deferred = () => {
      let resolve!: (v: unknown) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };
    const busyEl = () => document.querySelector('[aria-busy="true"]');

    it('dims the previous content while the next period loads, then shows the new data', async () => {
      const second = deferred();
      (loadCampaignAnalytics as Mock).mockResolvedValueOnce(payload(321)).mockReturnValueOnce(second.promise);
      render(<CampaignAnalyticsPanel campaign={campaign as never} funnel={funnel} />);
      expect(await screen.findByText('321')).toBeInTheDocument();
      expect(busyEl()).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
      expect(busyEl()).not.toBeNull();
      expect(screen.getByText('321')).toBeInTheDocument();
      second.resolve(payload(654));
      expect(await screen.findByText('654')).toBeInTheDocument();
      expect(screen.queryByText('321')).not.toBeInTheDocument();
      expect(busyEl()).toBeNull();
    });

    it('a failed second load shows the error and drops the first period data', async () => {
      const second = deferred();
      (loadCampaignAnalytics as Mock).mockResolvedValueOnce(payload(321)).mockReturnValueOnce(second.promise);
      render(<CampaignAnalyticsPanel campaign={campaign as never} funnel={funnel} />);
      expect(await screen.findByText('321')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
      second.reject(new Error('boom'));
      expect(await screen.findByText('Données indisponibles. Réessayez plus tard.')).toBeInTheDocument();
      expect(screen.queryByText('321')).not.toBeInTheDocument();
    });

    it('ignores an earlier response that arrives after a later one', async () => {
      const first = deferred();
      const second = deferred();
      (loadCampaignAnalytics as Mock).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      render(<CampaignAnalyticsPanel campaign={campaign as never} funnel={funnel} />);
      fireEvent.click(screen.getByRole('button', { name: '7 jours' }));
      second.resolve(payload(654));
      expect(await screen.findByText('654')).toBeInTheDocument();
      first.resolve(payload(321));
      await waitFor(() => expect(loadCampaignAnalytics).toHaveBeenCalledTimes(2));
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText('321')).not.toBeInTheDocument();
      expect(screen.getByText('654')).toBeInTheDocument();
    });
  });
});
