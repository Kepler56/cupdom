// Pure French scan-drop alert email builder. NO Deno/runtime imports, so it is
// unit-testable with Vitest and reusable by the served function (index.ts).
// Mirrors daily-digest/email.ts.

export interface ScanDropIncident {
  campaignSlug: string;
  sponsorName: string | null;
  burstCount: number;
  dropCount: number;
  windowMinutes: number;
}

export interface ScanAlertEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The alert a member receives when a live campaign's scans collapse after a peak
 * (#6) — the same incident the CRM bell shows, pushed as email for real-time
 * reaction during an event. One email per incident; the subject names the sponsor
 * so it is triageable from a phone lock screen.
 */
export function buildScanAlertEmail(incident: ScanDropIncident): ScanAlertEmail {
  const who = incident.sponsorName?.trim() || incident.campaignSlug;
  const subject = `⚠️ Chute de scans : ${who}`;

  const line1 =
    `La campagne « ${who} » a connu un pic de scans puis un arrêt brutal ` +
    `(${incident.burstCount} scans, puis ${incident.dropCount} sur les ${incident.windowMinutes} minutes suivantes).`;
  const line2 =
    'Cela signale souvent que quelque chose vient de casser côté terrain — un lien mort, ' +
    'un QR mal imprimé, une coupure au lieu — alors que la demande était bien là. À vérifier vite.';

  const text = `${subject}\n\n${line1}\n\n${line2}\n\nCampagne : ${incident.campaignSlug}`;

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:520px">` +
    `<h2 style="margin:0 0 12px">⚠️ Chute de scans : ${esc(who)}</h2>` +
    `<p style="margin:0 0 12px;color:#1a1a1a">${esc(line1)}</p>` +
    `<p style="margin:0 0 12px;color:#555">${esc(line2)}</p>` +
    `<p style="margin:0;color:#888;font-size:13px">Campagne : ${esc(incident.campaignSlug)}</p>` +
    `</div>`;

  return { subject, html, text };
}
