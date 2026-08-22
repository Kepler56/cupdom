import { beforeEach, describe, expect, it, vi } from 'vitest';

// `storedRow` simulates the qr_campaigns row: `update()` merges into it (like a
// real UPDATE), and `select().order()` projects only the columns actually named
// in the select string (like real PostgREST) — so the round-trip block below
// fails if a column is ever dropped from campaigns.ts's `COLS`, not just if the
// setter stops writing it.
let storedRow: Record<string, unknown>;

function freshRow(): Record<string, unknown> {
  return {
    slug: 'nike-hiver',
    sponsor_name: 'Nike',
    name: null,
    product: null,
    destination_url: 'https://nike.fr',
    active: true,
    deal_id: null,
    distributed_count: null,
    created_at: '2026-01-01T00:00:00Z',
    invested_amount_eur: null,
    venue: null,
    deals: null,
  };
}

/** Splits a PostgREST select string on top-level commas only (embeds like `deals(a, b)` stay one token). */
function splitTopLevel(cols: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of cols) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const eq = vi.fn();
const update = vi.fn((patch: Record<string, unknown>) => {
  storedRow = { ...storedRow, ...patch };
  return { eq };
});
const order = vi.fn((selectArg: string) =>
  Promise.resolve({
    data: [
      Object.fromEntries(
        splitTopLevel(selectArg)
          .map((token) => (token.includes('(') ? token.slice(0, token.indexOf('(')) : token))
          .filter((key) => key in storedRow)
          .map((key) => [key, storedRow[key]]),
      ),
    ],
    error: null,
  }),
);
// `select` closes over its own argument so `order` (called with no args in the real
// client) can still see which columns were requested.
const select = vi.fn((selectArg: string) => ({ order: () => order(selectArg) }));
const from = vi.fn(() => ({ update, select }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from }) }));

const { setInvestedAmount, setVenue, listScopeCampaigns } = await import('@/lib/campaigns/campaigns');

beforeEach(() => {
  eq.mockReset().mockResolvedValue({ error: null });
  update.mockClear();
  from.mockClear();
  storedRow = freshRow();
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

  it('clamps a negative amount to null, not 0 — zero is not neutral here: it would render 0,00 € par contact and claim the campaign was free', async () => {
    await setInvestedAmount('nike-hiver', -500);
    expect(update).toHaveBeenCalledWith({ invested_amount_eur: null });
  });

  it('throws when the write fails, so the input does not show a false enregistré ✓', async () => {
    eq.mockResolvedValueOnce({ error: new Error('boom') });
    await expect(setInvestedAmount('nike-hiver', 100)).rejects.toThrow('boom');
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

  it('throws when the write fails, so the input does not show a false enregistré ✓', async () => {
    eq.mockResolvedValueOnce({ error: new Error('boom') });
    await expect(setVenue('nike-hiver', 'Rex Club')).rejects.toThrow('boom');
  });
});

describe('round trip: a value written via the setters survives a reload', () => {
  // This is the layer the brief warns fails silently: if `invested_amount_eur` or
  // `venue` is ever dropped from campaigns.ts's `COLS`, listScopeCampaigns's actual
  // select string (captured by the `select` mock above) stops naming that column,
  // our PostgREST-shaped mock projects it out, and the assertion below catches it —
  // tsc stays clean and the setter tests above still pass, but this one won't.
  it('invested amount: written, then read back through listScopeCampaigns', async () => {
    await setInvestedAmount('nike-hiver', 1200);
    const [campaign] = await listScopeCampaigns();
    expect(campaign.investedAmountEur).toBe(1200);
  });

  it('venue: written (trimmed), then read back through listScopeCampaigns', async () => {
    await setVenue('nike-hiver', '  Rex Club ');
    const [campaign] = await listScopeCampaigns();
    expect(campaign.venue).toBe('Rex Club');
  });
});
