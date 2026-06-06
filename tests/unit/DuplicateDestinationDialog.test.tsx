import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DuplicateDestinationDialog } from '@/components/molecules/DuplicateDestinationDialog';
import type { Campaign } from '@/types/domain';

const existing: Campaign = {
  slug: 'abcd23',
  sponsorName: 'Nike',
  name: 'Nike Hiver',
  product: null,
  destinationUrl: 'https://nike.fr',
  state: 'Terminée',
  dealId: 'd1',
  distributedCount: null,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('DuplicateDestinationDialog', () => {
  it('Terminée: offers "Réactiver celle-ci ?" + "Créer quand même"', () => {
    const onReactivate = vi.fn();
    const onCreateAnyway = vi.fn();
    render(
      <DuplicateDestinationDialog
        kind="duplicate_terminee"
        existing={existing}
        onReactivate={onReactivate}
        onCreateAnyway={onCreateAnyway}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Réactiver celle-ci ?'));
    expect(onReactivate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Créer quand même'));
    expect(onCreateAnyway).toHaveBeenCalledOnce();
  });

  it('Active: warns and offers "Créer quand même" with NO reactivate button', () => {
    const onCreateAnyway = vi.fn();
    render(
      <DuplicateDestinationDialog
        kind="duplicate_active"
        existing={{ ...existing, state: 'Active' }}
        onReactivate={vi.fn()}
        onCreateAnyway={onCreateAnyway}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText('Réactiver celle-ci ?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Créer quand même'));
    expect(onCreateAnyway).toHaveBeenCalledOnce();
  });

  it('cancel calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <DuplicateDestinationDialog
        kind="duplicate_active"
        existing={existing}
        onCreateAnyway={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('Annuler'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
