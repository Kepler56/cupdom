import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignRow } from '@/components/molecules/CampaignRow';
import { useCanEdit } from '@/lib/scope';
import type { CampaignRowVM } from '@/types/domain';

vi.mock('@/lib/scope', () => ({ useCanEdit: vi.fn() }));
vi.mock('@/lib/campaigns/campaigns', () => ({ setCampaignState: vi.fn() }));

const base: CampaignRowVM = {
  slug: 'abcd23',
  sponsorName: 'Nike',
  name: 'Nike Été 2026',
  product: 'gourde',
  destinationUrl: 'https://nike.fr/ete',
  state: 'Active',
  dealId: 'd1',
  distributedCount: null,
  createdAt: '2026-06-01T00:00:00Z',
  ownerId: 'o1',
  ownerName: 'Eliah',
  ownerColor: '#f00',
  contactCompany: 'Nike',
  dealTitle: 'Deal Nike',
  stats: { slug: 'abcd23', totalScans: 3, uniquesPerDay: 2, bots: 1, activeScans: 2, termineeScans: 1, leads: 0, hasScans: true },
};

const renderRow = (row: CampaignRowVM) =>
  render(
    <table>
      <tbody>
        <CampaignRow row={row} onChanged={() => {}} />
      </tbody>
    </table>,
  );

describe('CampaignRow', () => {
  beforeEach(() => (useCanEdit as Mock).mockReset());

  it('owner (canEdit) sees the state toggle and the QR button; no owner chip', () => {
    (useCanEdit as Mock).mockReturnValue(true);
    renderRow(base);
    expect(screen.getByRole('button', { name: 'Voir le QR' })).toBeInTheDocument();
    expect(screen.getByText('Terminer')).toBeInTheDocument(); // Active → "Terminer"
    expect(screen.queryByText('Eliah')).not.toBeInTheDocument();
  });

  it('off-scope (no edit) hides the toggle and shows an owner chip; QR stays available', () => {
    (useCanEdit as Mock).mockReturnValue(false);
    renderRow(base);
    expect(screen.getByRole('button', { name: 'Voir le QR' })).toBeInTheDocument();
    expect(screen.queryByText('Terminer')).not.toBeInTheDocument();
    expect(screen.getByText('Eliah')).toBeInTheDocument();
  });

  it('legacy row (ownerId null) is read-only with a "— non lié" marker', () => {
    (useCanEdit as Mock).mockReturnValue(false);
    renderRow({ ...base, ownerId: null, ownerName: null, ownerColor: null });
    expect(screen.getByText('— non lié')).toBeInTheDocument();
    expect(screen.queryByText('Terminer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir le QR' })).toBeInTheDocument();
  });
});
