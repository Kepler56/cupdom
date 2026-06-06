import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Icon } from '@/components/atoms/Icon';
import { cn } from '@/lib/cn';

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

/** A sidebar navigation link with an active light-grey pill state. */
export function NavItem({ href, label, icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-canvas font-semibold text-text'
          : 'text-text-body hover:bg-canvas',
      )}
    >
      <Icon icon={icon} size={18} />
      {label}
    </Link>
  );
}
