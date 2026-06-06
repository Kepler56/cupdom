// Pure French digest-email builder. NO Deno/runtime imports so it is unit-testable
// with Vitest and reusable by the served function (index.ts).

export interface DigestReminder {
  company: string | null;
  note: string | null;
  remindOn: string;
}
export interface DigestTask {
  company: string | null;
  label: string;
  dueDate: string;
}
export interface DigestFollowUp {
  company: string | null;
  level: 'souple' | 'a_surveiller' | 'important' | 'urgent';
  silentDays: number;
}
export interface DigestItems {
  reminders: DigestReminder[];
  tasks: DigestTask[];
  followUps: DigestFollowUp[];
}
export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
}

const LEVEL_LABEL_FR: Record<DigestFollowUp['level'], string> = {
  souple: 'Souple',
  a_surveiller: 'À surveiller',
  important: 'Important',
  urgent: 'Urgent',
};

const fmtFr = (date: string): string =>
  new Intl.DateTimeFormat('fr-FR').format(new Date(`${date}T00:00:00`));

const co = (c: string | null): string => c ?? 'Contact';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build one French digest email, or `null` when there is nothing pending (AC-41).
 * `now` is injectable for deterministic tests.
 */
export function buildDigestEmail(
  member: { displayName: string; email: string },
  items: DigestItems,
  now: Date = new Date(),
): DigestEmail | null {
  const total = items.reminders.length + items.tasks.length + items.followUps.length;
  if (total === 0) return null;

  const dateFr = new Intl.DateTimeFormat('fr-FR').format(now);
  const subject = `Cupdom — votre récap du ${dateFr}`;

  // ----- plain text -----
  const textLines: string[] = [`Bonjour ${member.displayName},`, ''];
  if (items.reminders.length) {
    textLines.push('Rappels du jour :');
    for (const r of items.reminders) {
      textLines.push(`- ${co(r.company)} — ${r.note?.trim() || 'à traiter'} (${fmtFr(r.remindOn)})`);
    }
    textLines.push('');
  }
  if (items.tasks.length) {
    textLines.push('Tâches en retard :');
    for (const t of items.tasks) textLines.push(`- ${co(t.company)} — ${t.label} (échéance ${fmtFr(t.dueDate)})`);
    textLines.push('');
  }
  if (items.followUps.length) {
    textLines.push('Contacts à relancer :');
    for (const f of items.followUps) {
      textLines.push(`- ${co(f.company)} — ${LEVEL_LABEL_FR[f.level]} (${f.silentDays} j de silence)`);
    }
    textLines.push('');
  }
  const text = textLines.join('\n');

  // ----- html -----
  const section = (title: string, rows: string[]): string =>
    rows.length ? `<h2 style="font-size:15px;margin:16px 0 6px">${title}</h2><ul>${rows.join('')}</ul>` : '';

  const html =
    `<div style="font-family:system-ui,sans-serif;color:#18181b">` +
    `<p>Bonjour ${escapeHtml(member.displayName)},</p>` +
    section(
      'Rappels du jour',
      items.reminders.map(
        (r) => `<li>${escapeHtml(co(r.company))} — ${escapeHtml(r.note?.trim() || 'à traiter')} (${fmtFr(r.remindOn)})</li>`,
      ),
    ) +
    section(
      'Tâches en retard',
      items.tasks.map(
        (t) => `<li>${escapeHtml(co(t.company))} — ${escapeHtml(t.label)} (échéance ${fmtFr(t.dueDate)})</li>`,
      ),
    ) +
    section(
      'Contacts à relancer',
      items.followUps.map(
        (f) => `<li>${escapeHtml(co(f.company))} — ${LEVEL_LABEL_FR[f.level]} (${f.silentDays} j de silence)</li>`,
      ),
    ) +
    `</div>`;

  return { subject, html, text };
}
