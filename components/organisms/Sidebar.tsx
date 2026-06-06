'use client';

import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  ListChecks,
  Bell,
  QrCode,
  LogOut,
} from 'lucide-react';
import { NavItem } from '@/components/molecules/NavItem';
import { ScopeSwitcher } from '@/components/molecules/ScopeSwitcher';
import { Avatar } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { useMember, useSignOut } from '@/lib/profiles';

const NAV = [
  { href: '/apercu', label: 'Aperçu', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/taches', label: 'Tâches', icon: ListChecks },
  { href: '/rappels', label: 'Rappels', icon: Bell },
  { href: '/campagnes', label: 'Campagnes', icon: QrCode },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { member } = useMember();
  const signOut = useSignOut();

  return (
    <aside className="flex w-[210px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-input bg-primary text-sm font-bold text-primary-contrast">
          C
        </span>
        <span className="text-base font-semibold text-text">Cupdom</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-border p-3">
        <ScopeSwitcher />
        <div className="flex items-center gap-2">
          <Avatar name={member?.displayName ?? '…'} size="sm" />
          <span className="flex-1 truncate text-sm text-text">
            {member?.displayName ?? '…'}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Déconnexion"
            className="text-text-muted transition-colors hover:text-text"
          >
            <Icon icon={LogOut} size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
