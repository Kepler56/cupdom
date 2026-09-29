// Pure builder for the promo-code email (spec §4.2). No Deno globals → Vitest imports it.
import { safeHttpUrl } from './reward.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface PromoEmailInput {
  firstName: string;
  sponsor: string;
  campaignName: string | null;
  product: string | null;
  code: string;
  link: string;
}

export function buildPromoEmail(i: PromoEmailInput): { subject: string; html: string; text: string } {
  const link = safeHttpUrl(i.link);
  const what = i.campaignName?.trim() || i.product?.trim() || i.sponsor;
  const subject = `Votre code promo ${i.sponsor}`;

  const text = [
    `Bonjour ${i.firstName},`,
    '',
    `Merci d'avoir participé à « ${what} ». Voici votre code promo ${i.sponsor} :`,
    '',
    `    ${i.code}`,
    '',
    ...(link ? [`Utilisez-le ici : ${link}`, ''] : []),
    "L'équipe Cupdom",
  ].join('\n');

  const button = link
    ? `<p style="margin:24px 0"><a href="${esc(link)}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Utiliser mon code</a></p>
       <p style="font-size:12px;color:#71717a">Ou copiez ce lien : ${esc(link)}</p>`
    : '';

  const html = `<!doctype html><html lang="fr"><body style="font-family:system-ui,sans-serif;color:#18181b;max-width:520px;margin:auto;padding:24px">
  <p>Bonjour ${esc(i.firstName)},</p>
  <p>Merci d'avoir participé à « ${esc(what)} ». Voici votre code promo <strong>${esc(i.sponsor)}</strong> :</p>
  <p style="font-family:ui-monospace,monospace;font-size:28px;font-weight:700;letter-spacing:2px;background:#f7f7f8;border:1px dashed #a1a1aa;border-radius:8px;padding:16px;text-align:center">${esc(i.code)}</p>
  ${button}
  <p style="margin-top:32px;font-size:12px;color:#71717a">L'équipe Cupdom</p>
</body></html>`;

  return { subject, html, text };
}
