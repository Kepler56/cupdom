import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignLeadsTable } from '@/components/organisms/CampaignLeadsTable';
import { listCampaignLeads } from '@/lib/leads';
import { eraseLead } from '@/lib/leads/erase';
import type { Lead } from '@/types/domain';

vi.mock('@/lib/leads', () => ({ listCampaignLeads: vi.fn() }));
vi.mock('@/lib/export/downloadCsv', () => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/leads/erase', () => ({ eraseLead: vi.fn() }));

const lead: Lead = {
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
};

beforeEach(() => {
  (listCampaignLeads as Mock).mockReset().mockResolvedValue([lead]);
  (eraseLead as Mock).mockReset();
});

describe('CampaignLeadsTable — Effacer (RGPD)', () => {
  it('the erase action renders only when canEdit (AC-13)', async () => {
    const { rerender } = render(<CampaignLeadsTable slug="abcd23" canEdit={false} />);
    await screen.findByText('Marie Curie');
    expect(screen.queryByRole('button', { name: /Effacer \(RGPD\)/ })).not.toBeInTheDocument();

    rerender(<CampaignLeadsTable slug="abcd23" canEdit />);
    expect(await screen.findByRole('button', { name: /Effacer \(RGPD\)/ })).toBeInTheDocument();
  });

  it('cancel closes the dialog and does not call eraseLead', async () => {
    render(<CampaignLeadsTable slug="abcd23" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: /Effacer \(RGPD\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(eraseLead).not.toHaveBeenCalled();
  });

  it('confirm → eraseLead; ok swaps the row to "Lead anonymisé" + toast', async () => {
    (eraseLead as Mock).mockResolvedValue({ ok: true });
    render(<CampaignLeadsTable slug="abcd23" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: /Effacer \(RGPD\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));

    await waitFor(() => expect(eraseLead).toHaveBeenCalledWith('l1'));
    expect(await screen.findByText('Lead anonymisé')).toBeInTheDocument();
    expect(screen.getByText('Données du lead effacées')).toBeInTheDocument();
    expect(screen.queryByText('marie@x.fr')).not.toBeInTheDocument();
  });

  it('not_owner result surfaces the read-only toast and keeps the row', async () => {
    (eraseLead as Mock).mockResolvedValue({ ok: false, reason: 'not_owner', message: 'Lecture seule : seul le propriétaire peut effacer ce lead.' });
    render(<CampaignLeadsTable slug="abcd23" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: /Effacer \(RGPD\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));

    await waitFor(() => expect(screen.getByText(/Lecture seule/)).toBeInTheDocument());
    expect(screen.getByText('Marie Curie')).toBeInTheDocument(); // row untouched
  });
});
