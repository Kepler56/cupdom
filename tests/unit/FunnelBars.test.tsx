import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FunnelBars } from '@/components/organisms/FunnelBars';
import { buildFunnel } from '@/lib/funnel';
import type { FunnelSources } from '@/types/domain';

const funnelOf = (s: FunnelSources) => buildFunnel(s);

describe('FunnelBars', () => {
  it('renders the five stage labels in order', () => {
    render(<FunnelBars funnel={funnelOf({ distribues: 100, scannes: 80, formulaireVu: 60, formulaireSoumis: 20, offreAtteinte: 18 })} />);
    for (const label of ['Distribués', 'Scannés', 'Formulaire vu', 'Formulaire soumis', 'Offre atteinte']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('each bar width matches pctOfTop', () => {
    const funnel = funnelOf({ distribues: 100, scannes: 80, formulaireVu: 60, formulaireSoumis: 20, offreAtteinte: 18 });
    const { container } = render(<FunnelBars funnel={funnel} />);
    const bars = container.querySelectorAll('.bg-primary');
    expect(bars).toHaveLength(5);
    funnel.steps.forEach((s, i) => {
      expect((bars[i] as HTMLElement).style.width).toBe(`${s.pctOfTop}%`);
    });
  });

  it('shows the red drop badge on exactly one row (the biggest drop)', () => {
    const funnel = funnelOf({ distribues: 100, scannes: 80, formulaireVu: 60, formulaireSoumis: 20, offreAtteinte: 18 });
    const { container } = render(<FunnelBars funnel={funnel} />);
    const badges = screen.getAllByText(/−\d+ %/);
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('−67 %'); // formulaire_soumis step
    expect(container.querySelectorAll('.bg-danger-bg')).toHaveLength(1);
  });

  it('an all-equal funnel renders no red badge', () => {
    const funnel = funnelOf({ distribues: 50, scannes: 50, formulaireVu: 50, formulaireSoumis: 50, offreAtteinte: 50 });
    render(<FunnelBars funnel={funnel} />);
    expect(screen.queryByText(/−\d+ %/)).not.toBeInTheDocument();
  });
});
