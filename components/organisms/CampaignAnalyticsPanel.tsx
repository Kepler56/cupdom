'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { KpiCard } from '@/components/molecules/KpiCard';
import { PeriodSwitch } from '@/components/molecules/PeriodSwitch';
import { EmptyState } from '@/components/molecules/EmptyState';
import { FunnelBars } from '@/components/organisms/FunnelBars';
import { ScansArea } from '@/components/charts/ScansArea';
import { Heatmap } from '@/components/charts/Heatmap';
import { RankedBars } from '@/components/charts/RankedBars';
import { DeviceDonut } from '@/components/charts/DeviceDonut';
import { loadCampaignAnalytics, type CampaignAnalytics } from '@/lib/campaigns/analytics';
import { deriveCampaignKpis } from '@/lib/campaigns/campaignKpis';
import { parsePeriod, type PeriodPreset } from '@/lib/analytics/period';
import { CHARTE } from '@/lib/charte';
import type { Campaign, Funnel } from '@/types/domain';

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-border bg-surface p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

/** CRM campaign dashboard (spec §5). Period lives in ?p= so a reload keeps it. */
export function CampaignAnalyticsPanel({ campaign, funnel }: { campaign: Campaign; funnel: Funnel }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [period, setPeriod] = useState<PeriodPreset>(() => parsePeriod(params.get('p') ?? undefined));
  const [data, setData] = useState<{ period: PeriodPreset; value: CampaignAnalytics } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    loadCampaignAnalytics(campaign.slug, period, campaign.createdAt)
      .then((value) => live && setData({ period, value }))
      .catch(() => {
        if (!live) return;
        setData(null);
        setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [campaign.slug, campaign.createdAt, period]);

  function choose(p: PeriodPreset) {
    setPeriod(p);
    const next = new URLSearchParams(params.toString());
    next.set('p', p);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const header = (
    <div className="flex justify-end">
      <PeriodSwitch value={period} onChange={choose} />
    </div>
  );

  if (failed) return <>{header}<p className="text-sm text-text-muted">Données indisponibles. Réessayez plus tard.</p></>;
  if (!data) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-card bg-canvas" />)}
        </div>
        <div className="h-72 animate-pulse rounded-card bg-canvas" />
      </>
    );
  }

  const busy = data.period !== period;
  const { value } = data;
  const kpis = deriveCampaignKpis(value.overview, campaign);

  return (
    <>
      {header}
      <div aria-busy={busy || undefined} className={`space-y-6 transition-opacity ${busy ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpis.map((k) => <KpiCard key={k.key} data={k} />)}
      </div>

      {value.overview.current.scans === 0 ? (
        <EmptyState title="Aucun scan sur cette période">Les graphiques apparaîtront dès les premiers scans.</EmptyState>
      ) : (
        <>
          <Card title="Scans dans le temps"><ScansArea series={value.series} /></Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Entonnoir de conversion"><p className="-mt-3 mb-3 text-xs text-text-muted">Toutes périodes</p>
              <FunnelBars funnel={funnel} /></Card>
            <Card title="Top villes">
              <RankedBars ranking={value.cities} colour={CHARTE.bleu} />
              <p className="mt-3 text-xs text-text-muted">Localisation approximative (IP).</p>
            </Card>
          </div>
          <Card title="Quand scanne-t-on ?"><Heatmap heatmap={value.heatmap} /></Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Appareils"><DeviceDonut ranking={value.devices} /></Card>
            <Card title="Systèmes"><RankedBars ranking={value.os} colour={CHARTE.encre} suppressLowDataNote /></Card>
          </div>
        </>
      )}
      </div>
    </>
  );
}
