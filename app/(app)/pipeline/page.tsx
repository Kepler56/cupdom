'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

  if (visible.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border-strong bg-surface p-10 text-center">
        <p className="text-sm text-text-muted">Aucun deal pour le moment.</p>
        <p className="mt-1 text-sm text-text-faint">
          Les deals se créent depuis une fiche contact. Ouvrez un{' '}
          <Link href="/contacts" className="text-primary underline">
            contact
          </Link>{' '}
          puis l&apos;onglet <strong>Deals</strong> pour créer votre premier deal — il apparaîtra ici.
        </p>
      </div>
    );
  }

  return <PipelineBoard deals={visible} onChanged={() => setReloadKey((k) => k + 1)} />;
}
