import { Menu } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { SearchBox } from '@/components/molecules/SearchBox';
import { NotificationBell } from './NotificationBell';

/** Per-page top bar: page title, search, and the live notification bell.
 *  Below the CRM breakpoint a hamburger (onMenu) opens the collapsed sidebar drawer (AC-12). */
export function TopBar({ title, onMenu }: { title: string; onMenu?: () => void }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Ouvrir le menu"
            className="text-text-muted hover:text-text lg:hidden"
          >
            <Icon icon={Menu} size={20} />
          </button>
        )}
        <h1 className="truncate text-base font-semibold text-text">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <SearchBox />
        <NotificationBell />
      </div>
    </header>
  );
}
