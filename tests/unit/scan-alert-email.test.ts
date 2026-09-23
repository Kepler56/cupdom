import { describe, expect, it } from 'vitest';
import { buildScanAlertEmail } from '@/supabase/functions/scan-alert/email';

describe('buildScanAlertEmail', () => {
  it('names the sponsor in the subject and carries the burst/drop numbers', () => {
    const e = buildScanAlertEmail({
      campaignSlug: 'rex-club-2026',
      sponsorName: 'Nike',
      burstCount: 8,
      dropCount: 0,
      windowMinutes: 10,
    });
    expect(e.subject).toBe('⚠️ Chute de scans : Nike');
    expect(e.text).toContain('8 scans, puis 0');
    expect(e.text).toContain('10 minutes');
    expect(e.html).toContain('Nike');
    expect(e.text).toContain('rex-club-2026');
  });

  it('falls back to the slug when the sponsor name is missing', () => {
    const e = buildScanAlertEmail({
      campaignSlug: 'rex-club-2026',
      sponsorName: null,
      burstCount: 6,
      dropCount: 1,
      windowMinutes: 10,
    });
    expect(e.subject).toBe('⚠️ Chute de scans : rex-club-2026');
  });

  it('escapes HTML in the sponsor name so a crafted CRM value cannot inject markup', () => {
    const e = buildScanAlertEmail({
      campaignSlug: 's',
      sponsorName: '<script>x</script>',
      burstCount: 5,
      dropCount: 0,
      windowMinutes: 10,
    });
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
  });
});
