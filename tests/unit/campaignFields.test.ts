import { beforeEach, describe, expect, it, vi } from 'vitest';

const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }));

const { setInvestedAmount, setVenue } = await import('@/lib/campaigns/campaigns');

beforeEach(() => {
  eq.mockReset().mockResolvedValue({ error: null });
  update.mockClear();
  from.mockClear();
});

describe('setInvestedAmount', () => {
  it('writes the amount to the campaign the portal reads', async () => {
    await setInvestedAmount('nike-hiver', 1200);
    expect(from).toHaveBeenCalledWith('qr_campaigns');
    expect(update).toHaveBeenCalledWith({ invested_amount_eur: 1200 });
    expect(eq).toHaveBeenCalledWith('slug', 'nike-hiver');
  });

  it('clears the amount with null, not with zero', async () => {
    // Zero would mean « this campaign cost nothing », which would render a cost
    // per contact of 0,00 €. Absent and free are different claims (§4.7).
    await setInvestedAmount('nike-hiver', null);
    expect(update).toHaveBeenCalledWith({ invested_amount_eur: null });
  });
});

describe('setVenue', () => {
  it('writes the venue the ranking groups by', async () => {
    await setVenue('nike-hiver', 'Rex Club');
    expect(update).toHaveBeenCalledWith({ venue: 'Rex Club' });
    expect(eq).toHaveBeenCalledWith('slug', 'nike-hiver');
  });

  it('stores an emptied field as null, so the ranking hides it rather than grouping on ""', async () => {
    await setVenue('nike-hiver', '   ');
    expect(update).toHaveBeenCalledWith({ venue: null });
  });

  it('trims, because a trailing space would split one venue into two rows', async () => {
    await setVenue('nike-hiver', '  Badaboum ');
    expect(update).toHaveBeenCalledWith({ venue: 'Badaboum' });
  });
});
