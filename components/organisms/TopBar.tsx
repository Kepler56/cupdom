import { SearchBox } from '@/components/molecules/SearchBox';
import { NotificationBell } from './NotificationBell';

/** Per-page top bar: page title, search, and the live notification bell. */
export function TopBar({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <h1 className="text-base font-semibold text-text">{title}</h1>
      <div className="flex items-center gap-4">
        <SearchBox />
        <NotificationBell />
      </div>
    </header>
  );
}
