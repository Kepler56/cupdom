'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CampaignDetailHeader } from '@/components/organisms/CampaignDetailHeader';
import { CampaignMetrics } from '@/components/organisms/CampaignMetrics';
import { FunnelBars } from '@/components/organisms/FunnelBars';
import { CampaignLeadsTable } from '@/components/organisms/CampaignLeadsTable';
import { QrDialog } from '@/components/molecules/QrDialog';
import { useCanEdit } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import { listScopeCampaigns, setCampaignState, type CampaignWithOwner } from '@/lib/campaigns/campaigns';
import { emptyStats, loadCampaignStats } from '@/lib/campaigns/stats';
import { buildFunnel, loadFunnelSources } from '@/lib/funnel';
import { listCampaignLeads } from '@/lib/leads';
import type { CampaignStats, Funnel } from '@/types/domain';

// Campaign DETAIL page (Spec 4 AC-9): header + key metrics + conversion funnel + leads list (CSV).
// Reuses 2A (QR/lifecycle/state badge), 3A (leads table), and the Spec 4 funnel math/bars.
export default function CampaignDetailPage() {
  const slug = String(useParams().slug ?? '');
  const { profiles } = useProfiles();

  const [campaign, setCampaign] = useState<CampaignWithOwner | null>(null);
  const [stats, setStats] = useState<CampaignStats>(() => emptyStats(slug));
  const [funnel, setFunnel] = useState<Funnel>(() => buildFunnel({ distribues: 0, scannes: 0, formulaireVu: 0, formulaireSoumis: 0, offreAtteinte: 0 }));
  const [leadsCount, setLeadsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const list = await listScopeCampaigns();
      const c = list.find((x) => x.slug === slug) ?? null;
      const [statsMap, sources, leads] = await Promise.all([
        loadCampaignStats([slug]),
        loadFunnelSources(slug),
        listCampaignLeads(slug).catch(() => []),
      ]);
      if (!active) return;
      setCampaign(c);
      setStats(statsMap[slug] ?? emptyStats(slug));
      setFunnel(buildFunnel(sources));
      setLeadsCount(leads.length);
      setLoading(false);
    })().catch(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  const canEdit = useCanEdit(campaign?.ownerId ?? '');

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;
  if (!campaign) return <p className="text-sm text-text-muted">Campagne introuvable.</p>;

  const owner = campaign.ownerId ? profiles[campaign.ownerId] : undefined;

  async function toggle() {
    if (!campaign) return;
    try {
      await setCampaignState(slug, campaign.state === 'Active' ? 'Terminée' : 'Active');
      setReloadKey((k) => k + 1);
    } catch {
      // read-only / RLS — ignore
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/campagnes" className="text-xs text-text-muted hover:text-primary">
        ← Campagnes
      </Link>

      <CampaignDetailHeader
        campaign={campaign}
        canEdit={canEdit}
        ownerName={owner?.displayName ?? null}
        ownerColor={owner?.color ?? null}
        onToggle={toggle}
        onShowQr={() => setQrOpen(true)}
      />

      <CampaignMetrics stats={stats} leads={leadsCount} />

      <section className="rounded-card border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-text">Entonnoir de conversion</h2>
        <FunnelBars funnel={funnel} />
      </section>

      <CampaignLeadsTable slug={slug} canEdit={canEdit} />

      {qrOpen && <QrDialog campaign={campaign} onClose={() => setQrOpen(false)} />}
    </div>
  );
}
