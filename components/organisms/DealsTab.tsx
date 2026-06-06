'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { DealCard } from '@/components/molecules/DealCard';
import { DealForm } from '@/components/molecules/DealForm';
import { useCanEdit } from '@/lib/scope';
import { createDeal, listDeals, setStage, updateDeal, type DealInput } from '@/lib/deals';
import type { ContactStatus, Deal, DealStage } from '@/types/domain';

interface DealsTabProps {
  contact: ContactStatus;
  /** Called after any deal mutation so the hub can refetch the contact (statut may change). */
  onChanged: () => void;
}

export function DealsTab({ contact, onChanged }: DealsTabProps) {
  const canEdit = useCanEdit(contact.ownerId);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDeals(await listDeals(contact.id));
    } finally {
      setLoading(false);
    }
  }, [contact.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function afterChange() {
    await reload();
    onChanged();
  }

  async function handleSubmit(input: DealInput) {
    setSubmitting(true);
    setError(null);
    try {
      if (editing) await updateDeal(editing.id, input);
      else await createDeal(contact.id, input);
      setFormOpen(false);
      setEditing(null);
      await afterChange();
    } catch {
      setError('Enregistrement impossible (lecture seule ou champ invalide).');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStage(deal: Deal, stage: DealStage) {
    try {
      await setStage(deal.id, stage);
      await afterChange();
    } catch {
      // read-only / RLS — ignore (badge stays unchanged)
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + Nouveau deal
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : deals.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun deal.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              canEdit={canEdit}
              onStage={(stage) => handleStage(d, stage)}
              onEdit={() => {
                setEditing(d);
                setFormOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Campaigns nest under a deal — managed on the Campagnes page (Spec 2A). */}
      <Link
        href="/campagnes"
        className="block rounded-card border border-dashed border-border-strong p-4 text-center text-sm text-text-muted hover:border-primary hover:text-primary"
      >
        Gérer les campagnes →
      </Link>

      {formOpen && (
        <DealForm
          title={editing ? 'Modifier le deal' : 'Nouveau deal'}
          initial={
            editing
              ? {
                  title: editing.title ?? '',
                  stage: editing.stage,
                  valueEur: editing.valueEur,
                  expectedClose: editing.expectedClose,
                }
              : undefined
          }
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
