'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { CampaignsList } from '@/components/organisms/CampaignsList';
import { CampaignCreateForm } from '@/components/organisms/CampaignCreateForm';
import { useScope, useScopeFilter } from '@/lib/scope';
import { useProfiles } from '@/lib/profiles';
import { listScopeCampaigns, toCampaignRowVMs, type CampaignWithOwner } from '@/lib/campaigns/campaigns';
import { loadCampaignStats } from '@/lib/campaigns/stats';
import type { CampaignRowVM, CampaignStats } from '@/types/domain';

function CampagnesInner() {
  const { scope } = useScope();
  const scopeFilter = useScopeFilter();
  const { profiles } = useProfiles();
  const dealFilter = useSearchParams().get('deal');

  const [campaigns, setCampaigns] = useState<CampaignWithOwner[]>([]);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);

  const reload = () => setReloadKey((k) => k + 1);

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

  const rows: CampaignRowVM[] = useMemo(() => {
    // Legacy rows (ownerId null) are visible in "Tous" only; scopeFilter('') yields that.
    const visible = campaigns
      .filter((c) => scopeFilter(c.ownerId ?? ''))
      .filter((c) => !dealFilter || c.dealId === dealFilter);
    return toCampaignRowVMs(visible, stats, profiles);
  }, [campaigns, stats, scopeFilter, dealFilter, profiles]);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;

  return (
    <div className="space-y-4">
      {scope.kind === 'me' && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>+ Nouvelle campagne</Button>
        </div>
      )}

      <CampaignsList rows={rows} onChanged={reload} />

      {creating && (
        <CampaignCreateForm
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default function CampagnesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-muted">Chargement…</p>}>
      <CampagnesInner />
    </Suspense>
  );
}
