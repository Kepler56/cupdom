import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignLeadsTable } from '@/components/organisms/CampaignLeadsTable';
import { DistributedInput } from '@/components/molecules/DistributedInput';
import { listCampaignLeads } from '@/lib/leads';
import { downloadCsv } from '@/lib/export/downloadCsv';
import { setDistributedCount } from '@/lib/campaigns/campaigns';
import type { Lead } from '@/types/domain';

vi.mock('@/lib/leads', () => ({ listCampaignLeads: vi.fn() }));
vi.mock('@/lib/export/downloadCsv', () => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/campaigns/campaigns', () => ({ setDistributedCount: vi.fn() }));

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1',
  campaignSlug: 'abcd23',
  firstName: 'Marie',
  lastName: 'Curie',
  email: 'marie@x.fr',
  phone: '0612345678',
  firstSeenAt: '2026-06-01T10:00:00Z',
  lastActivityAt: '2026-06-02T10:00:00Z',
  createdAt: '2026-06-01T10:00:00Z',
  updatedAt: '2026-06-02T10:00:00Z',
  ...over,
});

describe('CampaignLeadsTable', () => {
  beforeEach(() => {
    (listCampaignLeads as Mock).mockReset().mockResolvedValue([lead()]);
    (downloadCsv as Mock).mockReset();
  });

  it('renders one row per lead with Nom/Email/Téléphone/Capturé le (fr-FR date)', async () => {
    render(<CampaignLeadsTable slug="abcd23" canEdit={false} />);
    expect(await screen.findByText('Marie Curie')).toBeInTheDocument();
    expect(screen.getByText('marie@x.fr')).toBeInTheDocument();
    expect(screen.getByText('0612345678')).toBeInTheDocument();
    expect(screen.getByText('01/06/2026')).toBeInTheDocument();
  });

  it('"Exporter les leads" downloads a BOM CSV with the FR header row', async () => {
    render(<CampaignLeadsTable slug="abcd23" canEdit={false} />);
    await screen.findByText('Marie Curie');
    fireEvent.click(screen.getByRole('button', { name: /Exporter les leads/ }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename, csv] = (downloadCsv as Mock).mock.calls[0] as [string, string];
    expect(filename).toMatch(/^leads_abcd23_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(csv.slice(1).split('\r\n')[0]).toBe('Prénom;Nom;Email;Téléphone;Capturé le');
  });

  it('empty leads → export button disabled', async () => {
    (listCampaignLeads as Mock).mockResolvedValue([]);
    render(<CampaignLeadsTable slug="abcd23" canEdit={false} />);
    await screen.findByText('Aucun lead capturé.');
    expect(screen.getByRole('button', { name: /Exporter les leads/ })).toBeDisabled();
  });
});

describe('DistributedInput', () => {
  beforeEach(() => (setDistributedCount as Mock).mockReset().mockResolvedValue(undefined));

  it('is editable and saves on blur when canEdit', async () => {
    render(<DistributedInput slug="abcd23" value={100} canEdit />);
    const input = screen.getByLabelText('Unités distribuées') as HTMLInputElement;
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.blur(input);
    await waitFor(() => expect(setDistributedCount).toHaveBeenCalledWith('abcd23', 250));
  });

  it('is disabled (read-only) when not canEdit (AC-13)', () => {
    render(<DistributedInput slug="abcd23" value={100} canEdit={false} />);
    expect(screen.getByLabelText('Unités distribuées')).toBeDisabled();
  });
});
