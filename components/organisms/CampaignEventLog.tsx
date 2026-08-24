'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { useProfiles } from '@/lib/profiles';
import { listCampaignEvents } from '@/lib/campaigns/events';
import { CAMPAIGN_EVENT_LABEL_FR, type CampaignEvent } from '@/types/domain';

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

interface CampaignEventLogProps {
  slug: string;
  onClose: () => void;
}

/** Append-only campaign history (AC-17): kind · detail · actor · date+time, newest first. */
export function CampaignEventLog({ slug, onClose }: CampaignEventLogProps) {
  const { profiles } = useProfiles();
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listCampaignEvents(slug)
      .then((e) => {
        if (active) {
          setEvents(e);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Historique de la campagne"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
    >
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-card border border-border bg-surface p-5 shadow-lg sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Historique</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-text-muted hover:text-text">
            <Icon icon={X} size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Chargement…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-text-muted">Aucun évènement.</p>
        ) : (
          <ul className="flex flex-col gap-3 overflow-y-auto">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-border pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-text">{CAMPAIGN_EVENT_LABEL_FR[e.kind]}</span>
                  <span className="shrink-0 text-xs text-text-faint">{dateTimeFmt.format(new Date(e.createdAt))}</span>
                </div>
                {e.detail && <p className="text-xs text-text-muted">{e.detail}</p>}
                <p className="text-xs text-text-faint">
                  {e.actorId ? profiles[e.actorId]?.displayName ?? 'Membre' : 'Système'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
