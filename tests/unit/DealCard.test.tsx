import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DealCard } from '@/components/molecules/DealCard';
import type { Deal } from '@/types/domain';

const base: Deal = {
  id: 'd1', contactId: 'c1', title: 'Été 2026', stage: 'GAGNÉ',
  valueEur: 2000, expectedClose: '2026-07-01', createdAt: '', updatedAt: '',
};

describe('DealCard', () => {
  it('read-only: stage Tag + formatted value, no edit controls', () => {
    render(<DealCard deal={base} canEdit={false} onStage={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('GAGNÉ')).toBeInTheDocument();
    // fr-FR currency uses narrow/no-break spaces; match separator-agnostically.
    expect(screen.getByText(/2\s?000\s?€/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Étape')).toBeNull();
    expect(screen.queryByLabelText('Modifier le deal')).toBeNull();
  });

  it('null value and date render em-dashes', () => {
    render(
      <DealCard
        deal={{ ...base, valueEur: null, expectedClose: null }}
        canEdit={false}
        onStage={() => {}}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/Clôture : —/)).toBeInTheDocument();
  });

  it('editable: shows the inline StageSelect and edit affordance', () => {
    render(<DealCard deal={base} canEdit onStage={() => {}} onEdit={() => {}} />);
    expect(screen.getByLabelText('Étape')).toBeInTheDocument();
    expect(screen.getByLabelText('Modifier le deal')).toBeInTheDocument();
  });
});
