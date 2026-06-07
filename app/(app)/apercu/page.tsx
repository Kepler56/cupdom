'use client';

import { useEffect, useState } from 'react';
import { useMember } from '@/lib/profiles';
import { useScopeFilter } from '@/lib/scope';
import { TodayPanel } from '@/components/organisms/TodayPanel';
import { ApercuKpiRow } from '@/components/organisms/ApercuKpiRow';
import { loadKpiInput } from '@/lib/apercuData';
import { deriveKpis } from '@/lib/kpis';
import type { KpiCardData } from '@/types/domain';

export default function ApercuPage() {
  const { member } = useMember();
  const scopeFilter = useScopeFilter();
  const [cards, setCards] = useState<KpiCardData[] | null>(null);

  useEffect(() => {
    let active = true;
    loadKpiInput(scopeFilter)
      .then((input) => {
        if (active) setCards(deriveKpis(input));
      })
      .catch(() => {
        if (active) setCards([]);
      });
    return () => {
      active = false;
    };
  }, [scopeFilter]);

  return (
    <div className="space-y-6">
      <p className="text-text-body">
        Bonjour{member?.displayName ? ` ${member.displayName}` : ''}, voici votre aperçu.
      </p>

      {cards ? (
        <ApercuKpiRow cards={cards} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-card border border-border bg-surface p-4">
              <p className="mt-2 text-2xl font-semibold text-text-faint">—</p>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text">À traiter aujourd&apos;hui</h2>
        <TodayPanel />
      </section>
    </div>
  );
}
