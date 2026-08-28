import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfidentialitePage from '@/app/confidentialite/page';

/**
 * CRM-X02. The page shipped without a « Données collectées » section, which is the
 * one a reader actually opens the policy to find. The others were already there.
 *
 * Section headings are asserted by name so removing one fails here rather than in
 * the next audit. The wording inside stays free to change.
 */
describe('politique de confidentialité', () => {
  it('carries every section the policy is required to have', () => {
    render(<ConfidentialitePage />);
    for (const heading of [
      'Responsables du traitement',
      'Données collectées',
      'Finalités',
      'Destinataires',
      'Durée de conservation',
      'Vos droits',
      'Nous contacter',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('describes the scan telemetry the edge function actually stores', () => {
    render(<ConfidentialitePage />);
    const collected = screen.getByRole('heading', { name: 'Données collectées' }).parentElement!;
    const text = collected.textContent!;

    // Coarse geolocation IS stored (qr_scans.country / region / city) — the policy
    // has to say so rather than claim no location is collected.
    expect(text).toMatch(/ville/i);
    // IP and user agent are hashed into visitor_hash, never stored raw.
    expect(text).toMatch(/adresse IP/i);
    expect(text).toMatch(/SHA-256/);
  });

  it('reaches the contact address for exercising rights', () => {
    render(<ConfidentialitePage />);
    expect(screen.getByRole('link', { name: 'confidentialite@cupdom.fr' })).toHaveAttribute(
      'href',
      'mailto:confidentialite@cupdom.fr',
    );
  });
});
