import { Point } from '@/components/atoms/Point';

/**
 * « Pas encore de données » — a real state with a real mark, not a blank area.
 * Spec §6: an empty result and a refused one must not look alike.
 */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-primary">
        <Point size={22} hole="var(--surface)" />
      </span>
      <p className="text-base font-bold text-text">{title}</p>
      {children && <p className="max-w-sm text-sm text-text-muted">{children}</p>}
    </div>
  );
}
