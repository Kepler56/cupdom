import { describe, expect, it } from 'vitest';
import { buildDigestEmail, type DigestItems } from '@/supabase/functions/daily-digest/email';

const empty: DigestItems = { reminders: [], tasks: [], followUps: [] };

describe('buildDigestEmail', () => {
  it('returns null when nothing is pending (AC-41)', () => {
    expect(buildDigestEmail({ displayName: 'Eliah', email: 'e@cupdom.fr' }, empty)).toBeNull();
  });

  it('builds a French email with the three sections + companies', () => {
    const items: DigestItems = {
      reminders: [{ company: 'Acme', note: 'Relancer', remindOn: '2026-06-06' }],
      tasks: [{ company: 'Globex', label: 'Appeler', dueDate: '2026-05-01' }],
      followUps: [{ company: 'Initech', level: 'urgent', silentDays: 31 }],
    };
    const email = buildDigestEmail({ displayName: 'Eliah', email: 'e@cupdom.fr' }, items, new Date(2026, 5, 6));
    expect(email).not.toBeNull();
    expect(email!.subject).toContain('06/06/2026');
    expect(email!.html).toContain('Rappels du jour');
    expect(email!.html).toContain('Tâches en retard');
    expect(email!.html).toContain('Contacts à relancer');
    expect(email!.html).toContain('Acme');
    expect(email!.text).toContain('Globex');
    expect(email!.html).toContain('Urgent'); // gone-quiet level label
  });

  it('escapes HTML in user-supplied fields', () => {
    const items: DigestItems = {
      reminders: [],
      tasks: [{ company: '<script>', label: 'x & y', dueDate: '2026-05-01' }],
      followUps: [],
    };
    const email = buildDigestEmail({ displayName: 'A', email: 'a@b.fr' }, items);
    expect(email!.html).toContain('&lt;script&gt;');
    expect(email!.html).not.toContain('<script>');
  });
});
