'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DealCard } from '@/components/molecules/DealCard';
import { DealForm } from '@/components/molecules/DealForm';
import { DealCampaignStat } from '@/components/molecules/DealCampaignStat';
import { useCanEdit } from '@/lib/scope';
import { createDeal, listDeals, setStage, updateDeal, type DealInput } from '@/lib/deals';
import { listScopeCampaigns } from '@/lib/campaigns/campaigns';
import { loadFunnelSourcesMany } from '@/lib/funnel';
import { countLeadsBySlug } from '@/lib/export/leadsLoaders';
import type { CampaignStat, ContactStatus, Deal, DealStage } from '@/types/domain';

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

  const [campaignStats, setCampaignStats] = useState<CampaignStat[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const ds = await listDeals(contact.id);
      setDeals(ds);

      // Nested campaigns under this contact's deals (Spec 4 AC-7).
      const dealIds = new Set(ds.map((d) => d.id));
      const campaigns = (await listScopeCampaigns()).filter((c) => c.dealId && dealIds.has(c.dealId));
      const slugs = campaigns.map((c) => c.slug);
      const [sources, leadCounts] = await Promise.all([loadFunnelSourcesMany(slugs), countLeadsBySlug(slugs)]);
      setCampaignStats(
        campaigns.map((c) => {
          const scans = sources[c.slug]?.scannes ?? 0;
          const leads = leadCounts[c.slug] ?? 0;
          return {
            slug: c.slug,
            name: c.name ?? c.sponsorName,
            active: c.state === 'Active',
            scans,
            leads,
            distribues: sources[c.slug]?.distribues ?? 0,
            conversionPct: scans === 0 ? 0 : Math.round((leads / scans) * 100),
          };
        }),
      );
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

      {/* Nested campaigns under this contact's deals (Spec 4 AC-7). */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint">Campagnes</h3>
        {campaignStats.length === 0 ? (
          <p className="text-sm text-text-muted">Aucune campagne sur ce contact.</p>
        ) : (
          campaignStats.map((stat) => <DealCampaignStat key={stat.slug} stat={stat} canEdit={canEdit} />)
        )}
      </div>

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
