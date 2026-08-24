'use client';

import { Button } from '@/components/atoms/Button';
import type { Campaign } from '@/types/domain';

interface DuplicateDestinationDialogProps {
  kind: 'duplicate_active' | 'duplicate_terminee';
  existing: Campaign;
  /** Reactivate the existing Terminée campaign (shown only for the `terminee` kind). */
  onReactivate?: () => void;
  /** Create a new campaign anyway (override, AC-7). */
  onCreateAnyway: () => void;
  onCancel: () => void;
}

/**
 * Duplicate-destination branch (AC-5/6/7). A Terminée match offers reactivation; an
 * Active match only warns. Both allow "Créer quand même" (override).
 */
export function DuplicateDestinationDialog({
  kind,
  existing,
  onReactivate,
  onCreateAnyway,
  onCancel,
}: DuplicateDestinationDialogProps) {
  const label = existing.name ?? existing.sponsorName;
  const isTerminee = kind === 'duplicate_terminee';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Destination déjà utilisée"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <h2 className="mb-3 text-base font-semibold text-text">Destination déjà utilisée</h2>
        <p className="mb-6 text-sm text-text-muted">
          {isTerminee ? (
            <>
              Une campagne terminée pointe déjà vers cette destination (« {label} »). Voulez-vous la réactiver
              ou en créer une nouvelle ?
            </>
          ) : (
            <>
              Une campagne active pointe déjà ici (« {label} »). Créer quand même une nouvelle campagne ?
            </>
          )}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          {isTerminee && onReactivate && (
            <Button variant="primary" onClick={onReactivate}>
              Réactiver celle-ci ?
            </Button>
          )}
          <Button variant={isTerminee ? 'secondary' : 'primary'} onClick={onCreateAnyway}>
            Créer quand même
          </Button>
        </div>
      </div>
    </div>
  );
}
