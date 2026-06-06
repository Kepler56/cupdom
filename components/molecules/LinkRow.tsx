'use client';

import { ExternalLink, Trash2 } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { isSafeUrl } from '@/lib/links';
import type { ContactLink } from '@/types/domain';

interface LinkRowProps {
  link: ContactLink;
  canEdit: boolean;
  onDelete: () => void;
}

export function LinkRow({ link, canEdit, onDelete }: LinkRowProps) {
  // Defence in depth: never render an anchor for a URL the safe-scheme check rejects.
  const safe = isSafeUrl(link.url);

  return (
    <div className="flex items-center gap-3 rounded-input border border-border bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        {safe ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-info-fg hover:underline"
          >
            {link.label}
            <Icon icon={ExternalLink} size={13} />
          </a>
        ) : (
          <span className="text-sm text-text-muted">{link.label} (URL non autorisée)</span>
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          aria-label={`Supprimer ${link.label}`}
          onClick={onDelete}
          className="text-text-muted hover:text-danger-fg"
        >
          <Icon icon={Trash2} size={15} />
        </button>
      )}
    </div>
  );
}
