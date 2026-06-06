'use client';

import { useEffect, useState } from 'react';
import { HistoryTimeline } from './HistoryTimeline';
import { listHistory } from '@/lib/history';
import type { ContactStatus, HistoryEntry } from '@/types/domain';

/** Read-only Historique tab: loads the contact's activity timeline. */
export function HistoriqueTab({ contact }: { contact: ContactStatus }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listHistory(contact.id)
      .then((e) => {
        if (active) {
          setEntries(e);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contact.id]);

  if (loading) return <p className="text-sm text-text-muted">Chargement…</p>;
  return <HistoryTimeline entries={entries} />;
}
