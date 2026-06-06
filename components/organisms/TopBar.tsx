import { Bell } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { SearchBox } from '@/components/molecules/SearchBox';

/** Per-page top bar: page title, search, and the notification bell. */
export function TopBar({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <h1 className="text-base font-semibold text-text">{title}</h1>
      <div className="flex items-center gap-4">
        <SearchBox />
        <button
          type="button"
          aria-label="Notifications"
          className="relative text-text-muted transition-colors hover:text-text"
        >
          <Icon icon={Bell} size={18} />
          {/* Static indicator for now; real notifications arrive in plan 1D. */}
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger-fg"
            aria-hidden
          />
        </button>
      </div>
    </header>
  );
}
