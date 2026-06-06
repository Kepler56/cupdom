import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatutBadge } from '@/components/molecules/StatutBadge';
import { STATUT_TONE } from '@/lib/status';
import { STATUTS } from '@/types/domain';

describe('StatutBadge', () => {
  it.each(STATUTS)('renders the French label for %s', (statut) => {
    render(<StatutBadge statut={statut} />);
    expect(screen.getByText(statut)).toBeInTheDocument();
  });

  it('covers every statut in the tone map', () => {
    for (const statut of STATUTS) {
      expect(STATUT_TONE[statut]).toBeTruthy();
    }
  });
});
