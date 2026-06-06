'use client';

import { useMember } from '@/lib/profiles';
import { TodayPanel } from '@/components/organisms/TodayPanel';

const KPIS = ['Contacts actifs', 'Scans (30 j)', 'Leads (30 j)', 'Pipeline (€)'];

export default function ApercuPage() {
  const { member } = useMember();

  return (
    <div className="space-y-6">
      <p className="text-text-body">
        Bonjour{member?.displayName ? ` ${member.displayName}` : ''}, voici votre aperçu.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((label) => (
          <div key={label} className="rounded-card border border-border bg-surface p-4">
            <p className="text-xs text-text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-text">—</p>
            <p className="mt-1 text-xs text-text-faint">Bientôt</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-text">À traiter aujourd&apos;hui</h2>
        <TodayPanel />
      </section>
    </div>
  );
}
