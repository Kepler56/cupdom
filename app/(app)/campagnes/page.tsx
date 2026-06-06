'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CampaignsList } from '@/components/organisms/CampaignsList';
import { useScopeFilter } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import { listScopeCampaigns, type CampaignWithOwner } from '@/lib/campaigns/campaigns';
import { emptyStats, loadCampaignStats } from '@/lib/campaigns/stats';
import type { CampaignRowVM, CampaignStats } from '@/types/domain';

function CampagnesInner() {
  const scopeFilter = useScopeFilter();
  const { profiles } = useProfiles();
  const dealFilter = useSearchParams().get('deal');

  const [campaigns, setCampaigns] = useState<CampaignWithOwner[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const list = await listScopeCampaigns();
      const s = await loadCampaignStats(list.map((c) => c.slug));
      if (active) {
        setCampaigns(list);
        setStats(s);
        setLoading(false);
      }
    })().catch(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const rows: CampaignRowVM[] = useMemo(
    () =>
      campaigns
        // Legacy rows (ownerId null) are visible in "Tous" only; scopeFilter('') yields that.
        .filter((c) => scopeFilter(c.ownerId ?? ''))
        .filter((c) => !dealFilter || c.dealId === dealFilter)
        .map((c) => {
          const owner = c.ownerId ? profiles[c.ownerId] : undefined;
          return {
            ...c,
            ownerName: owner?.displayName ?? null,
            ownerColor: owner?.color ?? null,
            stats: stats[c.slug] ?? emptyStats(c.slug),
          };
        }),
    [campaigns, stats, scopeFilter, dealFilter, profiles],
  );

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;

  return <CampaignsList rows={rows} onChanged={() => setReloadKey((k) => k + 1)} />;
}

export default function CampagnesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-muted">Chargement…</p>}>
      <CampagnesInner />
    </Suspense>
  );
}
