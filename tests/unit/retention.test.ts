import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { RETENTION_COPY_FR, RETENTION_MONTHS } from '@/lib/gdpr/retention';
import { eraseLead } from '@/lib/leads/erase';
import { createClient } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

const rpcMock = vi.fn();
beforeEach(() => {
  rpcMock.mockReset();
  (createClient as Mock).mockReturnValue({ rpc: rpcMock });
});

describe('retention copy', () => {
  it('is single-sourced from RETENTION_MONTHS (figure interpolated, not hard-coded)', () => {
    expect(RETENTION_MONTHS).toBe(36);
    expect(RETENTION_COPY_FR).toContain(`${RETENTION_MONTHS} mois`);
    expect(RETENTION_COPY_FR).toContain('anonymisées');
  });
});

describe('eraseLead error → reason mapping', () => {
  it('success → { ok: true }', async () => {
    rpcMock.mockResolvedValue({ error: null });
    expect(await eraseLead('l1')).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith('erase_lead', { p_lead: 'l1' });
  });

  it('insufficient_privilege (42501) → not_owner', async () => {
    rpcMock.mockResolvedValue({ error: { code: '42501', message: 'lecture seule' } });
    const res = await eraseLead('l1');
    expect(res).toMatchObject({ ok: false, reason: 'not_owner' });
  });

  it('no_data_found (P0002) → not_found', async () => {
    rpcMock.mockResolvedValue({ error: { code: 'P0002', message: 'lead introuvable' } });
    const res = await eraseLead('l1');
    expect(res).toMatchObject({ ok: false, reason: 'not_found' });
  });

  it('any other error → unknown', async () => {
    rpcMock.mockResolvedValue({ error: { code: '23505', message: 'boom' } });
    const res = await eraseLead('l1');
    expect(res).toMatchObject({ ok: false, reason: 'unknown' });
  });
});
