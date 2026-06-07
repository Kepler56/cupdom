'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CampaignLeadsTable } from '@/components/organisms/CampaignLeadsTable';
import { DistributedInput } from '@/components/molecules/DistributedInput';
import { useCanEdit } from '@/lib/scope';
import { listScopeCampaigns, type CampaignWithOwner } from '@/lib/campaigns/campaigns';

// Temporary campaign detail stub (Spec 3A Task 7). Spec 4 builds the full detail page (funnel
// chart over loadCampaignFunnel + richer layout); the leads table + distributed input are
// self-contained so that page can absorb them unchanged.
export default function CampaignDetailPage() {
  const slug = String(useParams().slug ?? '');
  const [campaign, setCampaign] = useState<CampaignWithOwner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listScopeCampaigns()
      .then((list) => {
        if (active) {
          setCampaign(list.find((c) => c.slug === slug) ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const canEdit = useCanEdit(campaign?.ownerId ?? '');

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;
  if (!campaign) return <p className="text-sm text-text-muted">Campagne introuvable.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/campagnes" className="text-xs text-text-muted hover:text-primary">
            ← Campagnes
          </Link>
          <h1 className="text-lg font-semibold text-text">{campaign.name ?? campaign.sponsorName}</h1>
        </div>
        <DistributedInput slug={slug} value={campaign.distributedCount} canEdit={canEdit} />
      </div>

      {/* Spec 4 adds the funnel chart here (over lib/funnel.ts#loadCampaignFunnel). */}
      <CampaignLeadsTable slug={slug} />
    </div>
  );
}
