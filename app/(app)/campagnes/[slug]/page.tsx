'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CampaignDetailHeader } from '@/components/organisms/CampaignDetailHeader';
import { CampaignAnalyticsPanel } from '@/components/organisms/CampaignAnalyticsPanel';
import { CampaignLeadsTable } from '@/components/organisms/CampaignLeadsTable';
import { QrDialog } from '@/components/molecules/QrDialog';
import { useCanEdit } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import { listScopeCampaigns, setCampaignState, type CampaignWithOwner } from '@/lib/campaigns/campaigns';
import { buildFunnel, loadFunnelSources } from '@/lib/funnel';
import type { Funnel } from '@/types/domain';

// Campaign DETAIL page: header + analytics dashboard (KPIs, charts, funnel) + leads list (CSV).
// Reuses 2A (QR/lifecycle/state badge), 3A (leads table), and the Spec 4 funnel math/bars.
export default function CampaignDetailPage() {
  const slug = String(useParams().slug ?? '');
  const { profiles } = useProfiles();

  const [campaign, setCampaign] = useState<CampaignWithOwner | null>(null);
  const [funnel, setFunnel] = useState<Funnel>(() => buildFunnel({ distribues: 0, scannes: 0, formulaireVu: 0, formulaireSoumis: 0, offreAtteinte: 0 }));
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      // The campaign list and funnel are independent — the funnel keys off the URL slug,
      // not off the list — so they run in ONE parallel batch instead of awaiting the list
      // first. Netlify(Ohio)→Supabase(eu-west) makes each serial round-trip ~85ms; this
      // removes one from every detail-page load. Behaviour is unchanged: the campaign is
      // still resolved by `.find()` over the same scope-filtered list (a slug outside the
      // current scope still reads « introuvable »).
      const [list, sources] = await Promise.all([listScopeCampaigns(), loadFunnelSources(slug)]);
      const c = list.find((x) => x.slug === slug) ?? null;
      if (!active) return;
      setCampaign(c);
      setFunnel(buildFunnel(sources));
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

      <Suspense fallback={null}>
        <CampaignAnalyticsPanel campaign={campaign} funnel={funnel} />
      </Suspense>

      <CampaignLeadsTable slug={slug} canEdit={canEdit} />

      {qrOpen && <QrDialog campaign={campaign} onClose={() => setQrOpen(false)} />}
    </div>
  );
}
