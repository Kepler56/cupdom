'use client';

import { useEffect, useMemo, useState } from 'react';
import { PipelineBoard } from '@/components/organisms/PipelineBoard';
import { useScopeFilter } from '@/lib/scope';
import { listScopeDeals, type ScopeDeal } from '@/lib/deals';

export default function PipelinePage() {
  const scopeFilter = useScopeFilter();
  const [deals, setDeals] = useState<ScopeDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listScopeDeals()
      .then((d) => {
        if (active) {
          setDeals(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const visible = useMemo(() => deals.filter((d) => scopeFilter(d.ownerId)), [deals, scopeFilter]);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;

  return <PipelineBoard deals={visible} onChanged={() => setReloadKey((k) => k + 1)} />;
}
