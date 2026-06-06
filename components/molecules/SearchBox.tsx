import { Search } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';

/** Top-bar search field. Presentational for now; wiring arrives with the list pages. */
export function SearchBox() {
  return (
    <div className="relative w-full max-w-xs">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint">
        <Icon icon={Search} size={16} />
      </span>
      <input
        type="search"
        placeholder="Rechercher…"
        aria-label="Rechercher"
        className="w-full rounded-input border border-border-strong bg-surface py-1.5 pl-8 pr-3 text-sm text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
